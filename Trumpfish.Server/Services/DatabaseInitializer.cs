using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Model.Bidding.AI;
using Trumpfish.Server.Configuration;
using Trumpfish.Server.Data;

namespace Trumpfish.Server.Services;

/// <summary>
/// Brings the database up to date on startup and creates the bootstrap account.
/// Runs as a hosted service so schema work is tied to the host lifetime rather than the entry point.
/// </summary>
/// <remarks>
/// The order matters: a pre-migration database is drained and dropped first (see <see cref="LegacyDatabaseUpgrader"/>), then the
/// migrations build the schema, then the administrator exists to carry out whatever the upgrade rescued.
/// <para>
/// Nothing else is seeded. Seed systems are ordinary rows curated through the application by an administrator, so a fresh
/// database deliberately starts empty rather than importing anything from disk.
/// </para>
/// </remarks>
public sealed class DatabaseInitializer : IHostedService {

    private readonly IServiceProvider _services;


    public DatabaseInitializer(IServiceProvider services) {
        _services = services;
    }


    public Task StartAsync(CancellationToken cancellationToken) => InitializeAsync(_services, cancellationToken);

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;


    public static async Task InitializeAsync(IServiceProvider services, CancellationToken cancellationToken = default) {
        using var scope = services.CreateScope();
        var provider = scope.ServiceProvider;

        var logger = provider.GetRequiredService<ILogger<DatabaseInitializer>>();
        var db = provider.GetRequiredService<TrumpfishDbContext>();

        var carriedOver = await provider.GetRequiredService<LegacyDatabaseUpgrader>().CaptureAndDropLegacyDataAsync(cancellationToken);

        await db.Database.MigrateAsync(cancellationToken);

        var admin = await EnsureAdminAsync(provider, logger, cancellationToken);
        await RestoreCarriedOverAsync(provider, db, admin, carriedOver, logger, cancellationToken);
    }


    private static async Task<UserRecord> EnsureAdminAsync(IServiceProvider provider, ILogger logger, CancellationToken cancellationToken) {
        var options = provider.GetRequiredService<IOptions<SeedOptions>>().Value;
        var users = provider.GetRequiredService<IUserService>();

        var admin = await users.FindByUsernameAsync(options.AdminUsername, cancellationToken);
        if (admin == null) {
            admin = await users.CreateAsync(options.AdminUsername, options.AdminPassword, isAdmin: true, "Administrator", cancellationToken);
            logger.LogInformation("Created the seeded administrator account '{Username}'.", admin.Username);
        }

        if (!provider.GetRequiredService<IHostEnvironment>().IsDevelopment() && options.AdminPassword == new SeedOptions().AdminPassword) {
            logger.LogWarning("The '{Username}' account is using the built-in development password. Set Seed__AdminPassword in the environment before exposing this server.", admin.Username);
        }

        return admin;
    }


    /// <summary>
    /// Stores whatever the legacy upgrade rescued, as seeds. Systems from before this change had no owner concept, so the
    /// administrator's curated set is the only sensible home for them.
    /// </summary>
    private static async Task RestoreCarriedOverAsync(IServiceProvider provider, TrumpfishDbContext db, UserRecord admin, IReadOnlyList<BiddingSystem> carriedOver, ILogger logger, CancellationToken cancellationToken) {
        if (carriedOver.Count == 0) {
            return;
        }

        var store = provider.GetRequiredService<IBiddingSystemStore>();
        var existing = await db.BiddingSystems.Where(system => system.IsSeed).Select(system => system.Name).ToListAsync(cancellationToken);
        var takenNames = new HashSet<string>(existing, StringComparer.OrdinalIgnoreCase);

        foreach (var system in carriedOver) {
            var name = string.IsNullOrWhiteSpace(system.SystemName) ? "System" : system.SystemName;
            if (!takenNames.Add(name)) {
                logger.LogWarning("Skipped the rescued bidding system '{System}' because a seed of that name already exists.", name);
                continue;
            }

            await store.CreateAsync(name, system, admin.Id, isAdmin: true, cancellationToken);
            logger.LogInformation("Carried the bidding system '{System}' over as a seed.", name);
        }
    }
}
