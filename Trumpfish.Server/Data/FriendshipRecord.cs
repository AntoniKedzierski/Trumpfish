namespace Trumpfish.Server.Data;

/// <summary>How far a friendship has got: asked for, or agreed to by both sides.</summary>
public enum FriendshipStatus {

    /// <summary>The requester has asked; the addressee has neither accepted nor declined yet.</summary>
    Pending,

    /// <summary>Both sides are friends. The row is symmetric from here on - which side asked no longer matters.</summary>
    Accepted
}

/// <summary>
/// One friendship, kept as a single row rather than two: the pair is stored in the direction it was asked in, and every read
/// has to look for the account on both sides of it. That way accepting cannot leave half a friendship behind, and removing one
/// cannot leave the other party still seeing it.
/// </summary>
public class FriendshipRecord {

    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>The account that sent the invitation.</summary>
    public Guid RequesterId { get; set; }

    public UserRecord? Requester { get; set; }

    /// <summary>The account the invitation was sent to; the only one that may accept it.</summary>
    public Guid AddresseeId { get; set; }

    public UserRecord? Addressee { get; set; }

    public FriendshipStatus Status { get; set; } = FriendshipStatus.Pending;

    public DateTimeOffset CreatedUtc { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>When the addressee accepted. Null while the invitation is still outstanding.</summary>
    public DateTimeOffset? AcceptedUtc { get; set; }
}
