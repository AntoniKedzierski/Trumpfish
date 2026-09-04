using Model;
using Model.Bidding;
using Model.Bidding.Bids;
using Model.Enums;
using Model.Helpers;
using Trumpfish.Server.Contracts;

namespace Trumpfish.Server.Services;

/// <summary>
/// Turns what the engine works with - hands, auctions, contracts - into the transport contracts. Shared by the batch simulator
/// and the practice table, so an auction looks exactly the same to the client whoever was sitting at it.
/// </summary>
internal static class AuctionMapping {

    public static SimulationContract PassedOut() {
        return new SimulationContract(true, null, null, BidColor.NoColor, false, false, "Pass out", null, null);
    }


    public static IReadOnlyList<SimulationHand> MapHands(IReadOnlyDictionary<PlayerPosition, Hand> hands) {
        return Enum.GetValues<PlayerPosition>().Select(position => MapHand(position, hands[position])).ToList();
    }


    public static SimulationHand MapHand(PlayerPosition position, Hand hand) {
        return new SimulationHand(
            position,
            hand.Cards.Select(card => new SimulationCard(card.Value, card.Color, card.ToString())).ToList(),
            hand.Points,
            hand.PointsNt,
            hand.SpadesCount,
            hand.HeartsCount,
            hand.DiamondsCount,
            hand.ClubsCount);
    }


    public static IReadOnlyList<SimulationBid> MapBidding(Auction auction) {
        var bids = new List<SimulationBid>(auction.AuctionHistory.Count);

        for (var i = 0; i < auction.AuctionHistory.Count; i++) {
            var bid = auction.AuctionHistory[i];
            bids.Add(new SimulationBid(i, auction.GetBidder(i), bid.Type, bid.Color, bid.Value, bid.IsFromSystem, Describe(bid), bid.Explanation));
        }

        return bids;
    }


    public static SimulationContract MapContract(Auction auction, Player[] players, IReadOnlyDictionary<PlayerPosition, Hand> hands) {
        var contract = auction.GetContract(players);
        if (contract.Passed) {
            return PassedOut();
        }

        var declarer = hands[contract.Player];
        var dummy = hands[contract.Player.GetPartner()];
        var noTrump = contract.Color == BidColor.NoTrump;

        // A no-trump contract is judged on no-trump points, a suit contract on honour points plus the length of the pair's trump fit.
        var pairPoints = noTrump ? declarer.PointsNt + dummy.PointsNt : declarer.Points + dummy.Points;
        var trumpCount = noTrump ? (int?)null : CountTrumps(declarer, dummy, contract.Color.ToCardColor());

        var label = $"{contract.Value}{contract.Color.ColorMark()}" + (contract.IsDoubled ? " X" : "") + (contract.IsRedoubled ? " XX" : "");
        return new SimulationContract(false, contract.Player, contract.Value, contract.Color, contract.IsDoubled, contract.IsRedoubled, label, pairPoints, trumpCount);
    }


    public static string Describe(Bid bid) {
        return bid.Type switch {
            BidType.Pass => "Pass",
            BidType.Double => "X",
            BidType.Redouble => "XX",
            _ => $"{bid.Value}{bid.Color.ColorMark()}"
        };
    }


    private static int CountTrumps(Hand declarer, Hand dummy, CardColor color) {
        return declarer.OfColor(color).Count() + dummy.OfColor(color).Count();
    }
}
