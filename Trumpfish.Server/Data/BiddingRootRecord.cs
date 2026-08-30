namespace Trumpfish.Server.Data;

/// <summary>A named top level branch of a system ("Otwarcia", "Obrona", ...). Ordering is explicit so the tree round trips in authoring order.</summary>
public class BiddingRootRecord {

    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid BiddingSystemId { get; set; }

    public BiddingSystemRecord? BiddingSystem { get; set; }

    public string? Name { get; set; }

    public int SortOrder { get; set; }

    public List<BidNodeRecord> Bids { get; set; } = [];
}
