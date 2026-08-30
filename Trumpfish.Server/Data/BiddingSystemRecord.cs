namespace Trumpfish.Server.Data;

/// <summary>
/// Header row of a bidding system. The tree itself lives in <see cref="BiddingRootRecord"/> and <see cref="BidNodeRecord"/>,
/// so the domain model in <c>Model</c> stays free of persistence concerns and is rebuilt by <c>BiddingSystemMapper</c>.
/// </summary>
/// <remarks>
/// A system is either a seed or somebody's own. A seed belongs to the installation rather than to a person, which is why
/// <see cref="OwnerId"/> is null for one; administrators curate seeds, everyone else forks them into a system of their own.
/// </remarks>
public class BiddingSystemRecord {

    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Owning account, or null for a seed.</summary>
    public Guid? OwnerId { get; set; }

    public UserRecord? Owner { get; set; }

    /// <summary>Whether this is a curated system offered to everyone. Always paired with a null <see cref="OwnerId"/>.</summary>
    public bool IsSeed { get; set; }

    public required string Name { get; set; }

    /// <summary>
    /// Seed this system was forked from. Null for a system written from scratch, and cleared when the seed is deleted -
    /// at which point the fork simply becomes an ordinary system of its owner's.
    /// </summary>
    public Guid? ForkedFromId { get; set; }

    public BiddingSystemRecord? ForkedFrom { get; set; }

    public List<BiddingSystemRecord> Forks { get; set; } = [];

    /// <summary>
    /// The seed's <see cref="ModifiedUtc"/> at the moment of the fork. Comparing it against the seed's current value is what
    /// tells the owner that the seed moved on and their copy could be taken again.
    /// </summary>
    public DateTimeOffset? ForkedFromVersionUtc { get; set; }

    public DateTimeOffset CreatedUtc { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset ModifiedUtc { get; set; } = DateTimeOffset.UtcNow;

    public List<BiddingRootRecord> Roots { get; set; } = [];
}
