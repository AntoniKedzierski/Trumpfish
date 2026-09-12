namespace Trumpfish.Server.Configuration;

/// <summary>
/// How much of the machine the double dummy solver may take. It is asked for one deal at a time, on demand, so the
/// defaults are deliberately small: a solver that is idle most of the time should not be sitting on hundreds of megabytes
/// of transposition table in an App Service plan sized for a web application.
/// </summary>
public class DoubleDummyOptions {

    public const string SectionName = "DoubleDummy";

    /// <summary>
    /// Turns the endpoint off without touching the deployment. A missing native library has the same effect on its own -
    /// the service reports itself unavailable rather than failing the request with a stack trace - so this is for the case
    /// where the library is there and should not be used.
    /// </summary>
    public bool Enabled { get; set; } = true;

    /// <summary>
    /// The large transposition table is worth it when thousands of deals are solved back to back and the table stays warm
    /// between them. One deal on request never gets there, so the small one is the default.
    /// </summary>
    public bool LargeTranspositionTable { get; set; } = false;

    /// <summary>What one solver starts with.</summary>
    public int TranspositionTableMb { get; set; } = 32;

    /// <summary>What one solver may grow to on a hard deal. The ceiling on the whole feature is this times <see cref="MaxConcurrency"/>.</summary>
    public int MaximumTranspositionTableMb { get; set; } = 128;

    /// <summary>
    /// How many deals may be solved at the same time. Each one holds a solver of its own, so this bounds the memory as
    /// much as the CPU. Left at zero it follows the machine, within reason.
    /// </summary>
    public int MaxConcurrency { get; set; } = 0;

    /// <summary>
    /// How long a solved table is kept. The table only depends on the fifty-two cards, so re-asking for the same deal -
    /// a practice deal reopened, a simulated deal analysed twice, the same deal at a different vulnerability - is free.
    /// </summary>
    public int CacheMinutes { get; set; } = 60;

    /// <summary>How many solved tables to keep. Each one is eighty bytes plus its key, so this is a generous number.</summary>
    public int CacheSize { get; set; } = 5000;


    /// <summary>The configured concurrency, or what the machine suggests when it was left to decide.</summary>
    public int ResolveConcurrency() {
        return MaxConcurrency > 0 ? MaxConcurrency : Math.Clamp(Environment.ProcessorCount / 2, 1, 2);
    }
}
