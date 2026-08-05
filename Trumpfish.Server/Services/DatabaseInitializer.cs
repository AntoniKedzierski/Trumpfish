using Microsoft.EntityFrameworkCore;
using Model.Bidding.AI;
using Trumpfish.Server.Data;

namespace Trumpfish.Server.Services;

/// <summary>Creates the database on startup and seeds the bundled bidding systems on a fresh install.</summary>
public static class DatabaseInitializer {

    public static async Task InitializeAsync(IServiceProvider services, CancellationToken cancellationToken = default) {
        using var scope = services.CreateScope();

        var db = scope.ServiceProvider.GetRequiredService<TrumpfishDbContext>();
        await db.Database.EnsureCreatedAsync(cancellationToken);

        if (await db.BiddingSystems.AnyAsync(cancellationToken)) {
            return;
        }

        // Bundled bidding system trees are copied next to the assembly by the Seed content item group.
        var seedDirectory = Path.Combine(AppContext.BaseDirectory, "Seed");
        if (!Directory.Exists(seedDirectory)) {
            return;
        }

        var store = scope.ServiceProvider.GetRequiredService<IBiddingSystemStore>();

        foreach (var seedPath in Directory.EnumerateFiles(seedDirectory, "*.json")) {
            var system = new BiddingSystem(seedPath);
            if (string.IsNullOrWhiteSpace(system.SystemName)) {
                system.SystemName = Path.GetFileNameWithoutExtension(seedPath);
            }

            await store.SaveAsync(system.SystemName, system, cancellationToken);
        }
    }
}
