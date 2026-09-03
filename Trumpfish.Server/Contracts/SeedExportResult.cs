namespace Trumpfish.Server.Contracts;

/// <summary>
/// What an export did to the seed folder. <paramref name="Removed"/> lists files that no longer match any seed - renaming or
/// deleting a seed has to reach the repository too, or the next start would resurrect it from the stale file.
/// </summary>
public record SeedExportResult(string Directory, IReadOnlyList<string> Written, IReadOnlyList<string> Removed);
