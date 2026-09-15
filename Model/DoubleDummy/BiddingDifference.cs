using System.Text.Json.Serialization;
using Model.Enums;

namespace Model.DoubleDummy;

/// <summary>What a pair could have done instead, and did not.</summary>
[JsonConverter(typeof(JsonStringEnumConverter<BiddingMiss>))]
public enum BiddingMiss {

    /// <summary>Nothing available would have paid better. The auction did as well as the cards allowed.</summary>
    None,

    /// <summary>A contract of their own was there to be bid, and reaching it was legal at the point they stopped.</summary>
    CouldHaveBid,

    /// <summary>They bought a contract the cards do not support and went down in it.</summary>
    Overbid,

    /// <summary>The opponents went down undoubled and the double was there for the taking.</summary>
    CouldHaveDoubled,

    /// <summary>They doubled a contract that made, and paid for the privilege.</summary>
    ShouldNotHaveDoubled
}

/// <summary>
/// What the auction cost one pair, and the single thing it could most usefully have done differently.
/// </summary>
/// <remarks>
/// Only alternatives that were actually available count. A pair whose best contract sits below the one the opponents
/// bought never had the chance to bid it, and telling it what it "should" have done there would be telling it to play a
/// different deal.
/// <para>
/// Where several alternatives were available - bid its own contract, or double the opponents - the one reported is the one
/// that would have paid most. There is no use naming the smaller of two mistakes.
/// </para>
/// </remarks>
/// <param name="Points">Negative for points lost, which is the usual answer. Zero when nothing available would have done better.</param>
public record BiddingDifference(Pair Pair, int Points, BiddingMiss Reason);
