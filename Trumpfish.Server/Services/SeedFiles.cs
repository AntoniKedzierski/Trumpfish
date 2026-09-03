using System.Runtime.CompilerServices;

namespace Trumpfish.Server.Services;

/// <summary>
/// Locates the <c>Seed</c> folder. The seed files are the source of truth for the curated systems: production applies them over
/// its database on every start, and a developer regenerates them from the in-memory database and commits the result.
/// </summary>
public static class SeedFiles {

    /// <summary>
    /// Where seeds are read from and, in a Debug build, written back to.
    /// </summary>
    /// <remarks>
    /// A Debug build works against the folder git actually tracks, so exporting and restarting round trips without a rebuild.
    /// A deployed build only ever has the copy placed next to the assembly by the <c>Seed</c> content item group.
    /// </remarks>
    public static string Directory {
        get {
            var projectDirectory = SourceProjectDirectory();
            if (Configuration.BuildInfo.IsDebug && projectDirectory != null && System.IO.Directory.Exists(projectDirectory)) {
                return Path.Combine(projectDirectory, "Seed");
            }

            return Path.Combine(AppContext.BaseDirectory, "Seed");
        }
    }


    /// <summary>Strips characters the file system rejects, so a system name can never escape the seed folder.</summary>
    public static string FileNameFor(string systemName) {
        var sanitized = string.Concat(systemName.Select(character => Path.GetInvalidFileNameChars().Contains(character) ? '_' : character)).Trim();
        return $"{(string.IsNullOrEmpty(sanitized) ? "system" : sanitized)}.json";
    }


    /// <summary>
    /// The project directory, derived from the path the compiler embedded for this file. That is what makes the export land in
    /// the working copy rather than in <c>bin</c>, no matter whether the server was started by the SDK or from its build output.
    /// </summary>
    private static string? SourceProjectDirectory([CallerFilePath] string sourcePath = "") {
        return Path.GetDirectoryName(Path.GetDirectoryName(sourcePath));
    }
}
