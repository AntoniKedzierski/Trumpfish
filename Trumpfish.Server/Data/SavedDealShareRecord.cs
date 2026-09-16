namespace Trumpfish.Server.Data;

/// <summary>
/// One deal handed to one friend. The deal itself is not copied: this row is permission to see somebody else's deal.
/// </summary>
/// <remarks>
/// That is what makes the two rules in the feature true at once. Deleting the deal takes every share of it with it - the
/// cascade below - and the person it was shared with can drop his own row without touching what the owner kept.
/// </remarks>
public class SavedDealShareRecord {

    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid DealId { get; set; }

    public SavedDealRecord? Deal { get; set; }

    /// <summary>The account the deal was shared with. A friend at the time it was shared; a friendship ending does not revoke it.</summary>
    public Guid ToUserId { get; set; }

    public UserRecord? ToUser { get; set; }

    public DateTimeOffset SharedUtc { get; set; } = DateTimeOffset.UtcNow;
}
