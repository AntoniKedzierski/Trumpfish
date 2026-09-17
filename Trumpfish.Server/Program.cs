using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Text.Json.Serialization;
using Trumpfish.Server.Configuration;
using Trumpfish.Server.Data;
using Trumpfish.Server.Filters;
using Trumpfish.Server.Hubs;
using Trumpfish.Server.Services;
using Trumpfish.Server.Services.Dds;

namespace Trumpfish.Server;

public partial class Program {

    private static async Task Main(string[] args) {

        var builder = WebApplication.CreateBuilder(args);

        builder.Services.AddControllers(options => {
            // Every method that is not a read has to carry an antiforgery token. See the filter for why MVC's own is not used.
            options.Filters.Add<AntiforgeryFilter>();
        }).AddJsonOptions(options => {
            // Enums travel as names so the generated TypeScript models stay readable and stable.
            options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
            options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
        });

        var database = builder.Configuration.GetSection(DatabaseOptions.SectionName).Get<DatabaseOptions>() ?? new DatabaseOptions();

        // A Release build has no in-memory branch compiled into it at all, so production cannot be talked into running on a
        // throwaway database by configuration alone.
        if (BuildInfo.IsDebug && database.UseInMemory) {
            // The shared-cache database is discarded once the last connection to it closes, so one is held open for the
            // lifetime of the host. Registering it in the container is what ties that lifetime to the application's.
            var keepAlive = new SqliteConnection(DatabaseOptions.InMemoryConnectionString);
            keepAlive.Open();
            builder.Services.AddSingleton(keepAlive);

            builder.Services.AddDbContext<TrumpfishDbContext>(options => options.UseSqlite(DatabaseOptions.InMemoryConnectionString));
        }
        else {
            // Resolved lazily inside the options lambda: build-time OpenAPI document generation builds the host
            // without ever resolving the context, and must not require a configured database.
            // Supplied by the ConnectionStrings__Trumpfish environment variable in Azure App Service.
            builder.Services.AddDbContext<TrumpfishDbContext>(options => options.UseNpgsql(builder.Configuration.GetConnectionString("Trumpfish") ?? throw new InvalidOperationException("Connection string 'Trumpfish' is not configured. Set ConnectionStrings__Trumpfish in the environment or appsettings.Development.json.")));
        }

        builder.Services.Configure<SeedOptions>(builder.Configuration.GetSection(SeedOptions.SectionName));
        builder.Services.Configure<DoubleDummyOptions>(builder.Configuration.GetSection(DoubleDummyOptions.SectionName));

        builder.Services.AddSingleton<IPasswordHasher, Pbkdf2PasswordHasher>();
        builder.Services.AddScoped<IUserService, UserService>();
        builder.Services.AddScoped<IBiddingSystemStore, BiddingSystemStore>();
        builder.Services.AddScoped<LegacyDatabaseUpgrader>();

        // Writing seed files back into the working copy is a developer command, so the real implementation only exists in a Debug build.
#if DEBUG
        builder.Services.AddScoped<ISeedExporter, SeedExporter>();
        builder.Services.AddScoped<ISavedDealArchive, SavedDealArchive>();
#else
        builder.Services.AddScoped<ISeedExporter, DisabledSeedExporter>();
        builder.Services.AddScoped<ISavedDealArchive, DisabledSavedDealArchive>();
#endif

        builder.Services.AddScoped<ISavedDealStore, SavedDealStore>();
        builder.Services.AddSingleton<IBiddingSimulator, BiddingSimulator>();
        builder.Services.AddSingleton<IPracticeService, PracticeService>();
        builder.Services.AddSingleton<IReplayService, ReplayService>();

        // Holds the pool of native solvers and the cache of tables it has already worked out, so it has to outlive a request.
        // It loads nothing until the first deal is actually sent to it.
        builder.Services.AddSingleton<IDoubleDummySolver, DoubleDummySolver>();

        builder.Services.AddScoped<IFriendService, FriendService>();

        // The live half of the application: who is connected, who has been invited, and the tables in progress. All three are
        // singletons holding nothing but memory, which is why the application has to run as a single instance.
        builder.Services.AddSingleton<IPresenceTracker, PresenceTracker>();
        builder.Services.AddSingleton<IDuoSessionService, DuoSessionService>();
        builder.Services.AddSingleton<ITableNotifier, TableNotifier>();

        builder.Services.AddSignalR().AddJsonProtocol(options => {
            // Matched to the controllers, so a contract reads the same whether it arrived over the hub or over a request.
            options.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter());
            options.PayloadSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
            options.PayloadSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
        });

        builder.Services.AddHostedService<DatabaseInitializer>();

        // A plain authentication cookie: the client is served from the same origin, so there is no token to hand around.
        // SameSite=Lax keeps it off most cross-site requests; the antiforgery pair registered below covers what Lax does not,
        // which is a top level form post.
        builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(options => {
            options.Cookie.Name = "trumpfish.auth";
            options.Cookie.HttpOnly = true;
            options.Cookie.SameSite = SameSiteMode.Lax;
            options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
            options.ExpireTimeSpan = TimeSpan.FromDays(14);
            options.SlidingExpiration = true;

            // The API has no login page to redirect to; the SPA routes to one itself once it sees the status code.
            options.Events.OnRedirectToLogin = context => {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return Task.CompletedTask;
            };
            options.Events.OnRedirectToAccessDenied = context => {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                return Task.CompletedTask;
            };
        });

        builder.Services.AddAuthorization();

        // The authentication cookie rides along on any request the browser makes to this origin, including one a foreign page
        // provoked, and SameSite=Lax does not stop a top level form post. The token pair is what makes a mutating call prove it
        // came from this application: the client asks for it at /api/auth/csrf and returns it in a header, having no hidden
        // form field to carry it in.
        builder.Services.AddAntiforgery(options => {
            options.HeaderName = "X-CSRF-TOKEN";
            options.Cookie.Name = "trumpfish.csrf";
            options.Cookie.SameSite = SameSiteMode.Lax;
            options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        });

        // Left unset, the key ring lives inside the container and is thrown away with it, which signs everybody out on every
        // deployment and invalidates every antiforgery token along with it. Pointed at a mounted directory, the keys outlive
        // the container. A developer's machine already persists them under the user profile and needs no path.
        var keyRingPath = builder.Configuration["DataProtection:KeyRingPath"];
        if (!string.IsNullOrWhiteSpace(keyRingPath)) {
            builder.Services.AddDataProtection()
                .PersistKeysToFileSystem(new DirectoryInfo(keyRingPath))
                // Fixed rather than derived from the content root, so keys stay readable when the path inside the image changes.
                .SetApplicationName("Trumpfish");
        }

        builder.Services.AddOpenApi();

        // Azure App Service terminates TLS at its front end and forwards plain HTTP to the container.
        // Without honouring X-Forwarded-Proto, UseHttpsRedirection would see HTTP and redirect forever.
        builder.Services.Configure<ForwardedHeadersOptions>(options => {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;

            // The front end addresses are not known ahead of time, so the default proxy allow-list cannot be used.
            options.KnownIPNetworks.Clear();
            options.KnownProxies.Clear();
        });

        var app = builder.Build();

        app.UseForwardedHeaders();

        // Answered ahead of everything else, and deliberately ahead of UseHttpsRedirection: the container probe reaches the
        // server over plain HTTP from inside the container, where there is no TLS to be redirected to and no proxy to set
        // X-Forwarded-Proto. It reports that the host is up and serving and nothing more - a database that is down must not
        // get a healthy application restarted underneath it.
        app.Map("/healthz", branch => branch.Run(context => {
            context.Response.StatusCode = StatusCodes.Status200OK;
            context.Response.ContentType = "text/plain";
            return context.Response.WriteAsync("OK");
        }));

        // The SPA is copied into wwwroot at publish time, so it is not part of the build-time
        // static asset manifest that MapStaticAssets relies on. Vite already fingerprints the
        // emitted file names, so plain static file serving is sufficient.
        app.UseDefaultFiles();
        app.UseStaticFiles();

        if (app.Environment.IsDevelopment()) {
            app.MapOpenApi();
        }

        app.UseHttpsRedirection();
        app.UseAuthentication();
        app.UseAuthorization();

        app.MapControllers();
        app.MapHub<TableHub>("/hubs/table");
        app.MapFallbackToFile("/index.html");

        await app.RunAsync();
    }
}
