using Trumpfish.Server.Contracts;

namespace Trumpfish.Server.Services;

/// <summary>
/// Stands in for the exporter on a Release build. Reporting <see cref="IsAvailable"/> as false is what keeps the client's
/// "export seeds" command hidden, and a deployed server has no source tree to write into anyway.
/// </summary>
public sealed class DisabledSeedExporter : ISeedExporter {

    public bool IsAvailable => false;

    public Task<SeedExportResult> ExportAllAsync(CancellationToken cancellationToken = default) {
        throw new InvalidOperationException("Seed export is a development-only command and is not available in this build.");
    }
}
