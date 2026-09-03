#if DEBUG
using Trumpfish.Server.Contracts;

namespace Trumpfish.Server.Services;

/// <summary>
/// The Debug-only implementation. The whole file is compiled out of a Release build, so a deployed server carries no code that
/// writes into a source tree - see <see cref="DisabledSeedExporter"/> for what stands in its place.
/// </summary>
public sealed class SeedExporter : ISeedExporter {

    private readonly IBiddingSystemStore _store;
    private readonly ILogger<SeedExporter> _logger;


    public SeedExporter(IBiddingSystemStore store, ILogger<SeedExporter> logger) {
        _store = store;
        _logger = logger;
    }


    public bool IsAvailable => true;


    public async Task<SeedExportResult> ExportAllAsync(CancellationToken cancellationToken = default) {
        var directory = SeedFiles.Directory;
        Directory.CreateDirectory(directory);

        var seeds = await _store.LoadAllSeedsAsync(cancellationToken);
        var written = new List<string>();

        foreach (var seed in seeds) {
            var fileName = SeedFiles.FileNameFor(seed.SystemName);
            await BiddingSystemJson.WriteFileAsync(Path.Combine(directory, fileName), seed, cancellationToken);
            written.Add(fileName);
        }

        // Whatever is left over no longer corresponds to a seed. Leaving it would mean the next start reads back a system the
        // administrator has just renamed or deleted, so the folder is made to mirror the database exactly.
        var expected = new HashSet<string>(written, StringComparer.OrdinalIgnoreCase);
        var removed = new List<string>();

        foreach (var path in Directory.EnumerateFiles(directory, "*.json")) {
            var fileName = Path.GetFileName(path);
            if (!expected.Contains(fileName)) {
                File.Delete(path);
                removed.Add(fileName);
            }
        }

        _logger.LogInformation("Exported {Written} seed file(s) to {Directory}, removed {Removed} stale file(s).", written.Count, directory, removed.Count);
        return new SeedExportResult(directory, written, removed);
    }
}
#endif
