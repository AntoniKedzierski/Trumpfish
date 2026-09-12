using Model;
using Model.DoubleDummy;
using Model.Enums;
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


    public static DoubleDummyResponse Map(DoubleDummyAnalysis analysis) {
        return new DoubleDummyResponse(
            analysis.Dealer,
            analysis.Vulnerability,
            analysis.Table.Entries().Select(entry => new DoubleDummyTricks(entry.Declarer, entry.Denomination, entry.Tricks)).ToList(),
            analysis.ParScore,
            analysis.ParPair,
            analysis.BestContract is null ? null : Map(analysis.BestContract),
            analysis.ParContracts.Select(Map).ToList());
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
