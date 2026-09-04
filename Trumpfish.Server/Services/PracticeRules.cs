using Model.Bidding;
using Model.Bidding.Bids;
using Model.Enums;
using Trumpfish.Server.Contracts;

namespace Trumpfish.Server.Services;

/// <summary>
/// Which bids the practice table lets the human make.
/// </summary>
/// <remarks>
/// Deliberately stricter than <see cref="Bid.IsBidLegal"/>, which the engine uses: that one lets a player double his own
/// partner and lets a redouble open the auction, and then walks off the end of an empty history working out what comes next.
/// Everything allowed here is allowed there too, so the auction never refuses a bid this class has offered.
/// </remarks>
internal static class PracticeRules {

    private static readonly BidColor[] Denominations = [BidColor.Clubs, BidColor.Diamonds, BidColor.Hearts, BidColor.Spades, BidColor.NoTrump];


    public static PracticeLegalBids Describe(Auction auction) {
        return new PracticeLegalBids(
            Denominations.ToDictionary(color => color, color => auction.GetLowestLegalValue(color)),
            CanDouble(auction),
            CanRedouble(auction));
    }


    public static bool IsLegal(Auction auction, Bid bid) {
        return bid.Type switch {
            BidType.Pass => true,
            BidType.Double => CanDouble(auction),
            BidType.Redouble => CanRedouble(auction),
            BidType.Submit => bid.Value >= auction.GetLowestLegalValue(bid.Color) && bid.Value <= 7,
            _ => false
        };
    }


    /// <summary>A contract can be doubled only while it belongs to the opponents, so an answering pass hands the right back.</summary>
    private static bool CanDouble(Auction auction) {
        return LastMeaningful(auction) is (BidType.Submit, true);
    }


    /// <summary>Only the doubled side redoubles, and only while the double still stands.</summary>
    private static bool CanRedouble(Auction auction) {
        return LastMeaningful(auction) is (BidType.Double, true);
    }


    /// <summary>
    /// The last bid that was not a pass, together with whether the player now on turn is on the other side of the table from it.
    /// Seats alternate, so an odd distance means an opponent said it.
    /// </summary>
    private static (BidType Type, bool ByOpponent)? LastMeaningful(Auction auction) {
        for (var i = auction.AuctionHistory.Count - 1; i >= 0; i--) {
            if (auction.AuctionHistory[i].Type == BidType.Pass) {
                continue;
            }

            return (auction.AuctionHistory[i].Type, (auction.AuctionHistory.Count - i) % 2 == 1);
        }

        return null;
    }
}
