using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Model.Bidding.AI;
using System.Text.Json;
using Trumpfish.Server.Configuration;
using Trumpfish.Server.Data;

namespace Trumpfish.Server.Services;

/// <summary>
/// Brings the database up to date on startup, creates the bootstrap account, and applies the seed files over the curated systems.
/// Runs as a hosted service so schema work is tied to the host lifetime rather than the entry point.
/// </summary>
/// <remarks>
/// The seed files are the source of truth for seeds. They are applied on every start, unprompted, so a deployment picks up
/// whatever the repository now says; a developer's in-memory database is empty each run and is filled from the same files.
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

        var carriedOver = await CreateSchemaAsync(provider, db, logger, cancellationToken);

        var admin = await EnsureAdminAsync(provider, logger, cancellationToken);
        await RestoreCarriedOverAsync(provider, db, admin, carriedOver, logger, cancellationToken);
        await ApplySeedFilesAsync(provider, logger, cancellationToken);
    }


    /// <summary>
    /// Builds the schema the way the provider in use requires: migrations against PostgreSQL, which is also where a
    /// pre-migration database has to be drained first, and a plain create for the throwaway development database, whose
    /// schema comes from the model and never needs versioning.
    /// </summary>
    private static async Task<IReadOnlyList<BiddingSystem>> CreateSchemaAsync(IServiceProvider provider, TrumpfishDbContext db, ILogger logger, CancellationToken cancellationToken) {
        if (!db.Database.IsNpgsql()) {
            await db.Database.EnsureCreatedAsync(cancellationToken);
            logger.LogInformation("Running on an in-memory database. It starts empty and is discarded when the server stops.");
            return [];
        }

        var carriedOver = await provider.GetRequiredService<LegacyDatabaseUpgrader>().CaptureAndDropLegacyDataAsync(cancellationToken);
        await db.Database.MigrateAsync(cancellationToken);
        return carriedOver;
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
    /// Makes the curated systems match the seed files exactly: every file is written over whatever the database held, and any
    /// seed whose file is gone is removed. Systems owned by an account are never touched.
    /// </summary>
    private static async Task ApplySeedFilesAsync(IServiceProvider provider, ILogger logger, CancellationToken cancellationToken) {
        var directory = SeedFiles.Directory;
        if (!Directory.Exists(directory)) {
            logger.LogWarning("No seed folder at {Directory}; no curated systems will be available.", directory);
            return;
        }

        var store = provider.GetRequiredService<IBiddingSystemStore>();
        var applied = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var path in Directory.EnumerateFiles(directory, "*.json")) {
            BiddingSystem? system;
            try {
                system = await BiddingSystemJson.ReadFileAsync(path, cancellationToken);
            }
            catch (JsonException exception) {
                // A malformed seed file is a mistake in the repository, not a reason to refuse to start.
                logger.LogError(exception, "Could not read the seed file {Path}. Skipping it.", path);
                continue;
            }

            if (system == null) {
                continue;
            }

            // The name inside the file wins, so renaming a system is done by editing it rather than the file name.
            var name = string.IsNullOrWhiteSpace(system.SystemName) ? Path.GetFileNameWithoutExtension(path) : system.SystemName;
            if (!applied.Add(name)) {
                logger.LogWarning("Two seed files both declare the system '{System}'. Only the first was applied.", name);
                continue;
            }

            await store.UpsertSeedAsync(name, system, cancellationToken);
        }

        var removed = await store.DeleteSeedsExceptAsync(applied, cancellationToken);
        foreach (var name in removed) {
            logger.LogInformation("Removed the seed '{System}', which no longer has a file.", name);
        }

        logger.LogInformation("Applied {Count} seed file(s) from {Directory}.", applied.Count, directory);
    }


    /// <summary>
    /// Stores whatever the legacy upgrade rescued, as seeds. Systems from before the owner concept existed have no other
    /// sensible home, and this only ever runs once, on the first start after the upgrade.
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
