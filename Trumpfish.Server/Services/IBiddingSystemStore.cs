using Model.Bidding.AI;
using Trumpfish.Server.Contracts;

namespace Trumpfish.Server.Services;

/// <summary>Why a store operation was refused, so the controller can pick a status code without knowing the rules.</summary>
public enum SystemAccessResult {
    Success,
    NotFound,
    /// <summary>The caller may know the system exists but may not touch it - a plain account reaching for a seed, for instance.</summary>
    Forbidden,
    NameTaken,
    /// <summary>Asked to take a seed's changes for a system that is not a fork, or whose seed is gone.</summary>
    NotAFork
}


public record SystemOperation<T>(SystemAccessResult Result, T? Value) {

    public static SystemOperation<T> Ok(T value) => new(SystemAccessResult.Success, value);

    public static SystemOperation<T> Fail(SystemAccessResult result) => new(result, default);
}


/// <summary>
/// Storage for bidding systems.
/// </summary>
/// <remarks>
/// Two kinds of system live here. Seeds are curated, owned by nobody, and only an administrator may write them - for an
/// administrator, seeds <em>are</em> their systems, so anything they create or import becomes one. Everyone else works on
/// systems of their own, which they obtain either by authoring one or by forking a seed. Callers pass the acting account and
/// whether it is an administrator; every method decides for itself what that account may see and change.
/// </remarks>
public interface IBiddingSystemStore {

    /// <summary>The systems the caller works on: the seeds for an administrator, their own systems for anyone else.</summary>
    Task<IReadOnlyList<BiddingSystemSummary>> ListAsync(Guid userId, bool isAdmin, CancellationToken cancellationToken = default);

    /// <summary>The seed catalogue, which any account may read in order to fork from it.</summary>
    Task<IReadOnlyList<BiddingSystemSummary>> ListSeedsAsync(CancellationToken cancellationToken = default);

    Task<SystemOperation<BiddingSystem>> GetAsync(Guid id, Guid userId, bool isAdmin, CancellationToken cancellationToken = default);

    /// <summary>Creates a system. An administrator's becomes a seed; anyone else's is their own.</summary>
    Task<SystemOperation<BiddingSystemSummary>> CreateAsync(string name, BiddingSystem system, Guid userId, bool isAdmin, CancellationToken cancellationToken = default);

    /// <summary>Replaces the whole tree of an existing system.</summary>
    Task<SystemOperation<BiddingSystemSummary>> SaveAsync(Guid id, BiddingSystem system, Guid userId, bool isAdmin, CancellationToken cancellationToken = default);

    Task<SystemOperation<BiddingSystemSummary>> RenameAsync(Guid id, string name, Guid userId, bool isAdmin, CancellationToken cancellationToken = default);

    Task<SystemAccessResult> DeleteAsync(Guid id, Guid userId, bool isAdmin, CancellationToken cancellationToken = default);

    /// <summary>Copies a seed into a system of the caller's own, recording where it came from.</summary>
    Task<SystemOperation<BiddingSystemSummary>> ForkAsync(Guid seedId, Guid userId, bool isAdmin, CancellationToken cancellationToken = default);

    /// <summary>Overwrites a fork with its seed's current tree, so the owner picks up the changes the administrator made.</summary>
    Task<SystemOperation<BiddingSystemSummary>> ReforkAsync(Guid id, Guid userId, bool isAdmin, CancellationToken cancellationToken = default);
}
