using Trumpfish.Server.Data;

namespace Trumpfish.Server.Services;

/// <summary>
/// Keeps saved deals in files beside the project, so that a development database which starts empty on every run does not
/// throw away what was kept while working with it.
/// </summary>
/// <remarks>
/// A developer's server runs on the in-memory database, which is discarded when the process ends. That is the right
/// behaviour for everything except the one thing the user asked to keep, so the deals - and only the deals - are mirrored
/// into a folder the working copy owns and read back on the next start.
///
/// None of this exists in a Release build: the implementation is compiled out and <see cref="DisabledSavedDealArchive"/>
/// stands in its place, so a deployed server neither writes into a source tree nor loads deals from one. Saved deals are
/// not seeds and never become part of what a deployment ships.
/// </remarks>
public interface ISavedDealArchive {

    /// <summary>False on a Release build, and on a developer's machine running against a real database.</summary>
    bool IsAvailable { get; }

    /// <summary>Writes one deal out. Failure is logged and swallowed: a file that cannot be written must not fail the save.</summary>
    Task KeepAsync(SavedDealRecord record, CancellationToken cancellationToken = default);

    /// <summary>Drops the copy of a deal that has been deleted, so the next start does not bring it back.</summary>
    Task ForgetAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>Reads back everything kept, for a database that has just been created empty.</summary>
    Task<IReadOnlyList<SavedDealRecord>> RestoreAsync(IReadOnlyDictionary<string, Guid> usersByName, CancellationToken cancellationToken = default);
}

/// <summary>What stands in for the archive wherever it must not run: a no-op that reports itself unavailable.</summary>
public sealed class DisabledSavedDealArchive : ISavedDealArchive {

    public bool IsAvailable => false;

    public Task KeepAsync(SavedDealRecord record, CancellationToken cancellationToken = default) => Task.CompletedTask;

    public Task ForgetAsync(Guid id, CancellationToken cancellationToken = default) => Task.CompletedTask;

    public Task<IReadOnlyList<SavedDealRecord>> RestoreAsync(IReadOnlyDictionary<string, Guid> usersByName, CancellationToken cancellationToken = default) {
        return Task.FromResult<IReadOnlyList<SavedDealRecord>>([]);
    }
}
