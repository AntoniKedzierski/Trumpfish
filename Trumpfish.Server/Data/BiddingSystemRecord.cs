using System.ComponentModel.DataAnnotations;

namespace Trumpfish.Server.Data;

/// <summary>
/// Storage row for a bidding system. The tree itself is kept as raw JSON so the domain model in <c>Model</c> stays free of persistence concerns.
/// </summary>
public class BiddingSystemRecord {

    public Guid Id { get; set; } = Guid.NewGuid();

    [MaxLength(200)]
    public required string Name { get; set; }

    public required string Json { get; set; }

    public DateTimeOffset ModifiedUtc { get; set; } = DateTimeOffset.UtcNow;
}
