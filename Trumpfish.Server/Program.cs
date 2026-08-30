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

        builder.Services.AddDbContext<TrumpfishDbContext>(options => options.UseSqlite(builder.Configuration.GetConnectionString("Trumpfish") ?? "Data Source=trumpfish.db"));
        builder.Services.AddScoped<IBiddingSystemStore, BiddingSystemStore>();
        builder.Services.AddSingleton<IBiddingSimulator, BiddingSimulator>();

        builder.Services.AddOpenApi();

        var app = builder.Build();

        await DatabaseInitializer.InitializeAsync(app.Services);

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
