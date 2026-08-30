namespace Trumpfish.Server.Contracts;

/// <summary>
/// Lightweight description of a stored bidding system, used by the client to render the load and manage lists.
/// </summary>
/// <param name="IsSeed">A curated system that belongs to the installation rather than to an account.</param>
/// <param name="ForkedFromId">The seed this system was taken from, or null once that seed is gone or it was never a fork.</param>
/// <param name="ForkedFromName">Name of that seed, carried along so the client does not need a second lookup to label the fork.</param>
/// <param name="SeedUpdateAvailable">The seed has been edited since this fork was taken, so the owner can take it again.</param>
public record BiddingSystemSummary(
    Guid Id,
    string Name,
    int RootCount,
    int BidCount,
    DateTimeOffset ModifiedUtc,
    bool IsSeed,
    Guid? ForkedFromId,
    string? ForkedFromName,
    bool SeedUpdateAvailable);


/// <summary>Body for creating a system or replacing the tree of an existing one.</summary>
public record SaveSystemRequest(string Name, Model.Bidding.AI.BiddingSystem System);


/// <summary>Body for renaming a system from the manage page.</summary>
public record RenameSystemRequest(string Name);
