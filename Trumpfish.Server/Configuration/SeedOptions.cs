namespace Trumpfish.Server.Configuration;

/// <summary>
/// Bootstrap account for a fresh database. The application needs one account to be usable at all, and the bundled seed systems
/// need an owner, so exactly one administrator is created - nothing else is seeded.
/// </summary>
public class SeedOptions {

    public const string SectionName = "Seed";

    public string AdminUsername { get; set; } = "admin";

    /// <summary>
    /// Development default. Override with <c>Seed__AdminPassword</c> anywhere the server is reachable by someone else -
    /// the initializer logs a warning outside Development when this is left at its default.
    /// </summary>
    public string AdminPassword { get; set; } = "admin";
}
