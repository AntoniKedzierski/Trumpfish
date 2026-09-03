namespace Trumpfish.Server.Configuration;

/// <summary>
/// Chooses where the data lives. A Debug build defaults to a throwaway in-memory database so the application runs with nothing
/// installed; a Release build always talks to PostgreSQL, and cannot be configured out of it.
/// </summary>
public class DatabaseOptions {

    public const string SectionName = "Database";

    /// <summary>
    /// Set to false in <c>appsettings.Development.json</c> to develop against a real PostgreSQL instead - useful for checking
    /// migrations, which the in-memory database never runs. Ignored by a Release build.
    /// </summary>
    public bool UseInMemory { get; set; } = BuildInfo.IsDebug;

    /// <summary>
    /// A named shared-cache database rather than a plain <c>:memory:</c> one, so every connection the pool opens sees the same
    /// data. It only stays alive while at least one connection is held open, which the host does for its whole lifetime.
    /// </summary>
    public const string InMemoryConnectionString = "Data Source=TrumpfishDebug;Mode=Memory;Cache=Shared";
}
