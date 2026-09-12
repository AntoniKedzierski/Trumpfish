using Model;
using Model.DoubleDummy;
using Model.Enums;
using Model.Helpers;
using Model.Scoring;
using Trumpfish.Server.Contracts;

namespace Trumpfish.Server.Services;

/// <summary>
/// Turns the deal the client sends into hands the solver can take, and the analysis it gets back into the transport
/// contract. The request shape is the simulator's, so anything the client already holds can be sent on as it stands.
/// </summary>
internal static class DoubleDummyMapping {

    private const int HandsInDeal = 4;
    private const int CardsInHand = 13;
    private const int CardsInDeck = 52;


    /// <summary>
    /// Checks that what arrived is a whole deal. The solver would refuse a broken one too, but with an error code from a
    /// C library rather than something worth putting in front of a player.
    /// </summary>
    public static string? Validate(SimulationDealRequest deal) {
        if (deal.Hands.Count != HandsInDeal || deal.Hands.Select(hand => hand.Position).Distinct().Count() != HandsInDeal) {
            return "Rozdanie musi zawierać cztery różne ręce.";
        }

        if (deal.Hands.Any(hand => hand.Cards.Count != CardsInHand)) {
            return "Każda ręka musi mieć trzynaście kart.";
        }

        var cards = deal.Hands.SelectMany(hand => hand.Cards).Select(card => (card.Value, card.Color)).ToList();
        if (cards.Distinct().Count() != CardsInDeck) {
            return "W rozdaniu powtarzają się karty.";
        }

        return null;
    }


    public static IReadOnlyDictionary<PlayerPosition, Hand> ToHands(SimulationDealRequest deal) {
        return deal.Hands.ToDictionary(hand => hand.Position, hand => new Hand(hand.Cards.Select(card => new Card(card.Value, card.Color))));
    }


    public static DoubleDummyResponse Map(DoubleDummyAnalysis analysis, DoubleDummyBid? bid) {
        return new DoubleDummyResponse(
            analysis.Dealer,
            analysis.Vulnerability,
            analysis.Table.Entries().Select(entry => new DoubleDummyTricks(entry.Declarer, entry.Denomination, entry.Tricks)).ToList(),
            analysis.ParScore,
            analysis.ParPair,
            analysis.BestContract is null ? null : Map(analysis.BestContract),
            analysis.ParContracts.Select(Map).ToList(),
            Map(analysis.Best(Pair.NorthSouth)),
            Map(analysis.Best(Pair.EastWest)),
            bid is null ? null : Map(analysis.Difference(Pair.NorthSouth, bid.Declarer, bid.Level, bid.Color, ToDoubling(bid))),
            bid is null ? null : Map(analysis.Difference(Pair.EastWest, bid.Declarer, bid.Level, bid.Color, ToDoubling(bid))),
            bid is null ? null : Played(analysis, bid));
    }


    /// <summary>
    /// The auction's own contract, solved. Sent alongside the difference it feeds into, because "you are four hundred out"
    /// is a much easier number to accept once the two hundred of it that came from going down is named separately.
    /// </summary>
    private static DoubleDummyPlayed Played(DoubleDummyAnalysis analysis, DoubleDummyBid bid) {
        var pair = bid.Declarer.GetPair();
        var tricks = analysis.Table.Tricks(bid.Declarer, bid.Color);

        return new DoubleDummyPlayed(
            pair,
            bid.Declarer,
            bid.Level,
            bid.Color,
            tricks,
            Math.Max(0, bid.Level + 6 - tricks),
            BridgeScoring.Score(bid.Level, bid.Color, tricks, analysis.IsVulnerable(pair), ToDoubling(bid)));
    }


    /// <summary>A doubled contract and a redoubled one score differently enough that the two flags cannot be collapsed.</summary>
    private static Doubling ToDoubling(DoubleDummyBid bid) {
        return bid.IsRedoubled ? Doubling.Redoubled
            : bid.IsDoubled ? Doubling.Doubled
            : Doubling.None;
    }


    private static DoubleDummyDifference? Map(BiddingDifference? difference) {
        return difference is null ? null : new DoubleDummyDifference(difference.Pair, difference.Points, difference.Reason);
    }


    private static DoubleDummyBestContract? Map(PairBest? best) {
        return best is null
            ? null
            : new DoubleDummyBestContract(best.Pair, best.Declarer, best.Level, best.Color, best.Tricks, best.Score, best.IsSacrifice, best.IsDefence, best.Label);
    }


    private static DoubleDummyContract Map(ParContract contract) {
        return new DoubleDummyContract(
            contract.Pair,
            contract.Declarer,
            contract.Level,
            contract.Color,
            contract.Tricks,
            contract.OverTricks,
            contract.UnderTricks,
            contract.IsSacrifice,
            contract.Label);
    }
}
