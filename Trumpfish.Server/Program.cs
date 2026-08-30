using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using System.Text.Json.Serialization;
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

        // Resolved lazily inside the options lambda: build-time OpenAPI document generation builds the host
        // without ever resolving the context, and must not require a configured database.
        // Supplied by the ConnectionStrings__Trumpfish environment variable in Azure App Service.
        builder.Services.AddDbContext<TrumpfishDbContext>(options => options.UseNpgsql(builder.Configuration.GetConnectionString("Trumpfish") ?? throw new InvalidOperationException("Connection string 'Trumpfish' is not configured. Set ConnectionStrings__Trumpfish in the environment or appsettings.Development.json.")));
        builder.Services.AddScoped<IBiddingSystemStore, BiddingSystemStore>();
        builder.Services.AddSingleton<IBiddingSimulator, BiddingSimulator>();
        builder.Services.AddHostedService<DatabaseInitializer>();

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
        app.UseAuthorization();

        app.MapControllers();
        app.MapFallbackToFile("/index.html");

        await app.RunAsync();
    }
}
