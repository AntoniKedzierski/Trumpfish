using Microsoft.EntityFrameworkCore;
using Model.Bidding.AI;
using Trumpfish.Server.Data;

namespace Trumpfish.Server.Services;

/// <summary>
/// Creates the database on startup and seeds the bundled bidding systems on a fresh install.
/// Runs as a hosted service so schema creation and seeding are tied to the host lifetime rather than the entry point.
/// </summary>
public sealed class DatabaseInitializer : IHostedService {

    private readonly IServiceProvider _services;

    public DatabaseInitializer(IServiceProvider services) {
        _services = services;
    }

    public Task StartAsync(CancellationToken cancellationToken) => InitializeAsync(_services, cancellationToken);

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    public static async Task InitializeAsync(IServiceProvider services, CancellationToken cancellationToken = default) {
        using var scope = services.CreateScope();

        var db = scope.ServiceProvider.GetRequiredService<TrumpfishDbContext>();
        await db.Database.EnsureCreatedAsync(cancellationToken);

        // Bundled bidding system trees are copied next to the assembly by the Seed content item group.
        var seedDirectory = Path.Combine(AppContext.BaseDirectory, "Seed");
        if (!Directory.Exists(seedDirectory)) {
            return;
        }

        var store = scope.ServiceProvider.GetRequiredService<IBiddingSystemStore>();
        var knownNames = await db.BiddingSystems.Select(record => record.Name).ToListAsync(cancellationToken);
        var takenNames = new HashSet<string>(knownNames, StringComparer.OrdinalIgnoreCase);

        foreach (var seedPath in Directory.EnumerateFiles(seedDirectory, "*.json")) {
            var fileName = Path.GetFileNameWithoutExtension(seedPath);

            // Seed files may declare the same SystemName, so fall back to the file name to keep every bundled system visible.
            if (takenNames.Contains(fileName)) {
                continue;
            }

            var system = new BiddingSystem(seedPath);
            var name = string.IsNullOrWhiteSpace(system.SystemName) || takenNames.Contains(system.SystemName) ? fileName : system.SystemName;
            if (takenNames.Contains(name)) {
                continue;
            }

            system.SystemName = name;
            await store.SaveAsync(name, system, cancellationToken);
            takenNames.Add(name);
        }
    }
}
