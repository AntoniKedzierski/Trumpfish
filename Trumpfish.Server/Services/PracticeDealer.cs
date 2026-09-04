using Model;
using Model.Bidding;
using Model.Bidding.Bids;
using Model.Enums;

namespace Trumpfish.Server.Services;

/// <summary>
/// Deals the four hands of a practice deal. One seat can be asked for a hand that satisfies a bid from the system tree - the
/// opening the player chose to practise - so that the sequence being practised is actually available to whoever has to start it.
/// </summary>
/// <remarks>
/// The hand is built rather than waited for: the suit lengths are drawn from the shapes the bid allows, weighted the way a real
/// deal would produce them, and only the honours are then redrawn until the point count lands in range. Plain rejection sampling
/// on a whole deal would need thousands of deals for a bid like "12-14 PC, 6+ trefli"; this needs a handful.
/// </remarks>
internal static class PracticeDealer {

    /// <summary>Redraws before the bid is declared impossible to hold. Only ranges nothing can satisfy ever get this far.</summary>
    private const int MaxAttempts = 3000;

    private static readonly CardColor[] SuitOrder = [CardColor.Spades, CardColor.Hearts, CardColor.Diamonds, CardColor.Clubs];


    /// <summary>
    /// Deals four hands, giving <paramref name="targetSeat"/> one that matches <paramref name="target"/>. Returns null when no
    /// hand can satisfy the bid, which means the ranges on it contradict each other.
    /// </summary>
    public static Dictionary<PlayerPosition, Hand>? Deal(Random random, BidNode? target, PlayerPosition targetSeat) {
        if (target == null) {
            return Split(Shuffle(FullDeck(), random), Enum.GetValues<PlayerPosition>());
        }

        var shapes = ShapesFor(target);
        if (shapes.Count == 0) {
            return null;
        }

        for (var attempt = 0; attempt < MaxAttempts; attempt++) {
            var suits = FullDeck().GroupBy(card => card.Color).ToDictionary(group => group.Key, group => Shuffle([.. group], random));
            var lengths = PickShape(shapes, random);

            // Each suit is already shuffled, so the leading cards of it are a uniformly drawn holding of that length.
            var chosen = SuitOrder.SelectMany((color, index) => suits[color].Take(lengths[index])).ToList();
            var hand = new Hand(chosen);

            if (!target.Matches(hand)) {
                continue;
            }

            var rest = Shuffle([.. SuitOrder.SelectMany((color, index) => suits[color].Skip(lengths[index]))], random);
            var others = Enum.GetValues<PlayerPosition>().Where(position => position != targetSeat).ToArray();

            var deal = Split(rest, others);
            deal[targetSeat] = hand;
            return deal;
        }

        return null;
    }


    /// <summary>Hands out thirteen cards to each seat in turn, in the order the seats are given.</summary>
    private static Dictionary<PlayerPosition, Hand> Split(List<Card> deck, PlayerPosition[] seats) {
        return seats
            .Select((position, index) => (position, hand: new Hand(deck.Skip(index * 13).Take(13))))
            .ToDictionary(entry => entry.position, entry => entry.hand);
    }


    /// <summary>
    /// Every distribution of thirteen cards the bid's suit ranges allow, each weighted by how many holdings have that shape.
    /// Without the weight a 4-4-4-1 would come up as often as a 4-3-3-3, and the practice hands would feel nothing like real ones.
    /// </summary>
    private static List<(int[] Lengths, double Weight)> ShapesFor(BidNode target) {
        var ranges = new[] { target.SpadesCardRange, target.HeartsCardRange, target.DiamondsCardRange, target.ClubsCardRange };
        var shapes = new List<(int[], double)>();

        for (var spades = Lowest(ranges[0]); spades <= Highest(ranges[0]); spades++) {
            for (var hearts = Lowest(ranges[1]); hearts <= Highest(ranges[1]); hearts++) {
                for (var diamonds = Lowest(ranges[2]); diamonds <= Highest(ranges[2]); diamonds++) {
                    var clubs = 13 - spades - hearts - diamonds;
                    if (clubs < Lowest(ranges[3]) || clubs > Highest(ranges[3])) {
                        continue;
                    }

                    shapes.Add(([spades, hearts, diamonds, clubs], Holdings(spades) * Holdings(hearts) * Holdings(diamonds) * Holdings(clubs)));
                }
            }
        }

        return shapes;
    }


    private static int[] PickShape(List<(int[] Lengths, double Weight)> shapes, Random random) {
        var target = random.NextDouble() * shapes.Sum(shape => shape.Weight);

        foreach (var shape in shapes) {
            target -= shape.Weight;
            if (target <= 0) {
                return shape.Lengths;
            }
        }

        return shapes[^1].Lengths;
    }


    private static int Lowest(NumberRange? range) {
        return Math.Clamp(range?.Lower ?? 0, 0, 13);
    }


    private static int Highest(NumberRange? range) {
        return Math.Clamp(range?.Upper ?? 13, 0, 13);
    }


    /// <summary>Number of holdings of a given length in one suit, which is what makes a shape more or less likely.</summary>
    private static double Holdings(int length) {
        var result = 1.0;
        for (var i = 0; i < length; i++) {
            result = result * (13 - i) / (i + 1);
        }

        return result;
    }


    private static List<Card> FullDeck() {
        return [.. from color in Enum.GetValues<CardColor>() from value in Enum.GetValues<CardValue>() select new Card(value, color)];
    }


    /// <summary>Fisher-Yates, so every permutation is equally likely.</summary>
    private static List<Card> Shuffle(List<Card> cards, Random random) {
        for (var i = cards.Count - 1; i > 0; i--) {
            var j = random.Next(i + 1);
            (cards[i], cards[j]) = (cards[j], cards[i]);
        }

        return cards;
    }
}
