namespace Trumpfish.Server.Data;

/// <summary>
/// An application account. Authentication is deliberately minimal (username plus a salted hash) so it can be swapped for an
/// external identity provider later without touching the bidding system tables, which only reference <see cref="Id"/>.
/// </summary>
public class UserRecord {

    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Name exactly as the user typed it, used for display.</summary>
    public required string Username { get; set; }

    /// <summary>Upper-cased <see cref="Username"/>, carried as a separate column so the uniqueness index stays case insensitive without a functional index.</summary>
    public required string NormalizedUsername { get; set; }

    /// <summary>Opaque, self describing hash produced by <c>IPasswordHasher</c>; the format prefix lets the algorithm change without a data migration.</summary>
    public required string PasswordHash { get; set; }

    public string? DisplayName { get; set; }

    public bool IsAdmin { get; set; }

    public DateTimeOffset CreatedUtc { get; set; } = DateTimeOffset.UtcNow;

    public List<BiddingSystemRecord> BiddingSystems { get; set; } = [];


    public static string Normalize(string username) => username.Trim().ToUpperInvariant();
}
