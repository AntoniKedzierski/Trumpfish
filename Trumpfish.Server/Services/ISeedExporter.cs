using Trumpfish.Server.Contracts;

namespace Trumpfish.Server.Services;

/// <summary>
/// Writes the seed systems out of the database and into the working copy, so a developer can commit them and share them with
/// the team. This is the other half of the loop that <see cref="SeedFiles"/> describes: startup reads the files, this writes them.
/// </summary>
public interface ISeedExporter {

    /// <summary>False on a Release build, where writing into the source tree is compiled out entirely.</summary>
    bool IsAvailable { get; }

    /// <summary>Replaces the contents of the seed folder with the seeds currently in the database.</summary>
    Task<SeedExportResult> ExportAllAsync(CancellationToken cancellationToken = default);
}
