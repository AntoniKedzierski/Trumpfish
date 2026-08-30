using Microsoft.EntityFrameworkCore;
using Model.Bidding.AI;
using System.Data.Common;
using System.Text.Json;
using Trumpfish.Server.Data;

namespace Trumpfish.Server.Services;

/// <summary>
/// Carries data across the move from the single JSON blob table to the normalised schema.
/// </summary>
/// <remarks>
/// Databases created before this change were built by <c>EnsureCreated</c>, so they have a <c>BiddingSystems</c> table with a
/// <c>Json</c> column and no migrations history. EF cannot migrate such a database - the two mechanisms are mutually exclusive -
/// so the systems are read out into memory, the legacy table is dropped, and the migrations then build the real schema. The
/// captured systems are re-saved afterwards through the normal store, which is what actually splits them into rows.
/// </remarks>
public sealed class LegacyDatabaseUpgrader {

    private readonly TrumpfishDbContext _db;
    private readonly ILogger<LegacyDatabaseUpgrader> _logger;


    public LegacyDatabaseUpgrader(TrumpfishDbContext db, ILogger<LegacyDatabaseUpgrader> logger) {
        _db = db;
        _logger = logger;
    }


    /// <summary>
    /// Reads every system out of a pre-migration database and drops the legacy table, leaving the schema ready for
    /// <c>Migrate</c>. Returns an empty list for a fresh database or one that is already on the migrated schema.
    /// </summary>
    public async Task<IReadOnlyList<BiddingSystem>> CaptureAndDropLegacyDataAsync(CancellationToken cancellationToken = default) {
        if (!await _db.Database.CanConnectAsync(cancellationToken)) {
            return [];
        }

        if (!await HasLegacyTableAsync(cancellationToken)) {
            return [];
        }

        var systems = await ReadLegacySystemsAsync(cancellationToken);
        _logger.LogWarning("Found a pre-migration database with {Count} bidding system(s). Converting it to the normalised schema.", systems.Count);

        await _db.Database.ExecuteSqlRawAsync("DROP TABLE \"BiddingSystems\"", cancellationToken);
        return systems;
    }


    /// <summary>
    /// The legacy table is recognised by its <c>Json</c> column: the normalised schema keeps the same table name, so the name
    /// alone cannot tell the two apart.
    /// </summary>
    private async Task<bool> HasLegacyTableAsync(CancellationToken cancellationToken) {
        await using var command = _db.Database.GetDbConnection().CreateCommand();
        command.CommandText = """
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = current_schema() AND table_name = 'BiddingSystems' AND column_name = 'Json'
            )
            """;

        await using var _ = await OpenAsync(command.Connection!, cancellationToken);
        return await command.ExecuteScalarAsync(cancellationToken) is true;
    }


    private async Task<List<BiddingSystem>> ReadLegacySystemsAsync(CancellationToken cancellationToken) {
        var systems = new List<BiddingSystem>();

        await using var command = _db.Database.GetDbConnection().CreateCommand();
        command.CommandText = "SELECT \"Name\", \"Json\" FROM \"BiddingSystems\" ORDER BY \"Name\"";

        await using var _ = await OpenAsync(command.Connection!, cancellationToken);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken)) {
            var name = reader.GetString(0);

            try {
                var system = BiddingSystemJson.Deserialize(reader.GetString(1));
                if (system == null) {
                    continue;
                }

                system.SystemName = name;
                systems.Add(system);
            }
            catch (JsonException exception) {
                // One unreadable blob must not block the upgrade; the system is reported and skipped so the rest still survives.
                _logger.LogError(exception, "Could not read the legacy bidding system '{System}'. It will not be carried over - export it from the previous version if you still need it.", name);
            }
        }

        return systems;
    }


    /// <summary>Opens the shared context connection when it is closed, and closes it again only if this call is what opened it.</summary>
    private static async Task<IAsyncDisposable> OpenAsync(DbConnection connection, CancellationToken cancellationToken) {
        if (connection.State == System.Data.ConnectionState.Open) {
            return new NoopScope();
        }

        await connection.OpenAsync(cancellationToken);
        return new CloseScope(connection);
    }


    private sealed class NoopScope : IAsyncDisposable {

        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
    }


    private sealed class CloseScope(DbConnection connection) : IAsyncDisposable {

        public async ValueTask DisposeAsync() => await connection.CloseAsync();
    }
}
