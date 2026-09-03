using Model.Bidding.AI.Engine;
using Model.Enums;

namespace Trumpfish.Server.Data;

/// <summary>
/// One bid in the tree. Children point at their parent through <see cref="ParentId"/>, so a whole system loads with a single
/// flat query per table and is reassembled in memory by <c>BiddingSystemMapper</c>.
/// </summary>
/// <remarks>
/// <see cref="Id"/> and <see cref="NodeId"/> are deliberately separate. The domain identity is only unique inside one system -
/// importing the same JSON twice yields two systems whose nodes carry identical <see cref="NodeId"/> values - so the table needs
/// a key of its own for rows and foreign keys to hang off.
/// </remarks>
public class BidNodeRecord {

    /// <summary>Row identity, unique across every system.</summary>
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>The domain <c>BidNode.NodeId</c>, which clients use to address one exact bid within its own system.</summary>
    public Guid NodeId { get; set; }

    /// <summary>Root this node belongs to, denormalised onto every node so an entire tree loads without walking the parent chain.</summary>
    public Guid RootId { get; set; }

    public BiddingRootRecord? Root { get; set; }

    /// <summary>Null for the bids sitting directly under the root.</summary>
    public Guid? ParentId { get; set; }

    public BidNodeRecord? Parent { get; set; }

    public List<BidNodeRecord> Children { get; set; } = [];

    /// <summary>Position among siblings. The browser lets the author reorder bids, so insertion order has to be stored.</summary>
    public int SortOrder { get; set; }

    // --- Bid ---

    public BidType Type { get; set; }

    public BidColor Color { get; set; }

    public int? Value { get; set; }

    public bool IsFromSystem { get; set; }

    public string? Explanation { get; set; }

    // --- BidNode ---

    public string? Description { get; set; }

    public string? Condition { get; set; }

    public string? Convention { get; set; }

    public int? PointsLower { get; set; }
    public int? PointsUpper { get; set; }

    public int? SpadesLower { get; set; }
    public int? SpadesUpper { get; set; }

    public int? HeartsLower { get; set; }
    public int? HeartsUpper { get; set; }

    public int? DiamondsLower { get; set; }
    public int? DiamondsUpper { get; set; }

    public int? ClubsLower { get; set; }
    public int? ClubsUpper { get; set; }

    public decimal? SpadesStops { get; set; }
    public decimal? HeartsStops { get; set; }
    public decimal? DiamondsStops { get; set; }
    public decimal? ClubsStops { get; set; }

    public string? ColorDistribution { get; set; }

    public int? Aces { get; set; }

    public int? Kings { get; set; }

    public bool OpenerBid { get; set; }

    public bool SignOff { get; set; }

    public bool OneRoundForcing { get; set; }

    public bool GameForcing { get; set; }

    public bool AutomaticResponse { get; set; }

    public bool GoToOpenings { get; set; }

    public bool IsPreferred { get; set; }

    /// <summary>Excluded from the simulation together with everything below it. Only the head of the branch carries the flag.</summary>
    public bool IsDisabled { get; set; }

    public BiddingGoal RealizedGoal { get; set; }

    public string? AiSource { get; set; }

    // --- Interjection: the opponent bid squeezed in before this one, flattened because only a handful of its fields carry meaning. ---

    /// <summary>Null when there is no interjection; a value here is what marks the embedded bid as present.</summary>
    public BidType? InterjectionType { get; set; }

    public BidColor? InterjectionColor { get; set; }

    public int? InterjectionValue { get; set; }

    public bool? InterjectionIsFromSystem { get; set; }

    public string? InterjectionExplanation { get; set; }
}
