using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using System.Text.Json.Serialization;
using Trumpfish.Server.Configuration;
using Trumpfish.Server.Data;
using Trumpfish.Server.Services;

namespace Trumpfish.Server;

public partial class Program {

    private static async Task Main(string[] args) {

        var builder = WebApplication.CreateBuilder(args);

        builder.Services.AddControllers().AddJsonOptions(options => {
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

        builder.Services.AddSingleton<IPasswordHasher, Pbkdf2PasswordHasher>();
        builder.Services.AddScoped<IUserService, UserService>();
        builder.Services.AddScoped<IBiddingSystemStore, BiddingSystemStore>();
        builder.Services.AddScoped<LegacyDatabaseUpgrader>();

        // Writing seed files back into the working copy is a developer command, so the real implementation only exists in a Debug build.
#if DEBUG
        builder.Services.AddScoped<ISeedExporter, SeedExporter>();
#else
        builder.Services.AddScoped<ISeedExporter, DisabledSeedExporter>();
#endif
        builder.Services.AddSingleton<IBiddingSimulator, BiddingSimulator>();
        builder.Services.AddSingleton<IPracticeService, PracticeService>();
        builder.Services.AddHostedService<DatabaseInitializer>();

        // A plain authentication cookie: the client is served from the same origin, so there is no token to hand around.
        // SameSite=Lax is what keeps a cross-site form from riding along on the cookie, since there is no antiforgery token yet.
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
        app.MapFallbackToFile("/index.html");

        await app.RunAsync();
    }
}
