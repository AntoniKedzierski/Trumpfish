using Model;
using Model.DoubleDummy;
using Model.Enums;
using Trumpfish.Server.Contracts;

namespace Trumpfish.Server.Services;

/// <summary>
/// Solves a single deal double dummy. Deliberately one deal at a time: the analysis is something the player asks for on a
/// deal in front of him, never something a batch of deals is put through, so there is no bulk entry point to reach for.
/// </summary>
public interface IDoubleDummySolver {

    /// <summary>
    /// Whether the native library is there and loadable. False is an ordinary state, not a bug - a development machine
    /// without the library built, or a deployment where the feature is switched off - so callers answer it rather than throw.
    /// </summary>
    bool IsAvailable { get; }

    /// <summary>Why the solver cannot be used, when it cannot. Null while it can.</summary>
    string? UnavailableReason { get; }

    /// <summary>What the loaded library reports about itself, for diagnostics.</summary>
    DoubleDummyInfo Describe();

    /// <summary>
    /// Solves the deal and works out par for the given dealer and vulnerability.
    /// </summary>
    /// <param name="hands">All four hands. Anything less is not a deal the solver can be asked about.</param>
    /// <param name="cancellationToken">
    /// Honoured while queueing for a solver and before the native call starts. Once that call is under way it cannot be
    /// interrupted - it is a single call into C++ - so a cancelled request stops being waited on rather than stopping the work.
    /// </param>
    Task<DoubleDummyAnalysis> AnalyseAsync(
        IReadOnlyDictionary<PlayerPosition, Hand> hands,
        PlayerPosition dealer,
        Vulnerability vulnerability,
        CancellationToken cancellationToken);
}
