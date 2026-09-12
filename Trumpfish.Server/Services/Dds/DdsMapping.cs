using Model;
using Model.DoubleDummy;
using Model.Enums;
using Model.Helpers;
using System.Text;

namespace Trumpfish.Server.Services.Dds;

/// <summary>
/// Translates between the application's model and the numbering DDS works in. Worth reading before touching: three of the
/// four conventions differ from ours, and two of them differ from each other inside DDS itself.
///
/// Seats agree - north, east, south, west - and that is the end of the agreement. Suits run the other way round: ours
/// start at clubs, the solver's start at spades. The trick table indexes denominations spades to clubs and then no trump,
/// while a par contract indexes them no trump and then spades to clubs. A holding is a bit set where the bit number is
/// the rank, so the deuce sits on bit two and the ace on bit fourteen.
/// </summary>
internal static class DdsMapping {

    /// <summary>Packs four hands into the bit sets DDS solves from.</summary>
    public static DdsTableDeal ToTableDeal(IReadOnlyDictionary<PlayerPosition, Hand> hands) {
        var deal = new DdsTableDeal();

        foreach (var seat in Enum.GetValues<PlayerPosition>()) {
            var hand = hands[seat];

            foreach (var color in Enum.GetValues<CardColor>()) {
                deal[(int)seat, ToDdsSuit(color)] = ToHolding(hand.OfColor(color));
            }
        }

        return deal;
    }


    /// <summary>
    /// Identifies a deal by the very bits that were solved. The table is a pure function of them, so this is what a cached
    /// result is keyed by - and it cannot drift from the deal the way a key built out of the model could.
    /// </summary>
    public static string Fingerprint(DdsTableDeal deal) {
        var key = new StringBuilder(DdsLayout.Hands * DdsLayout.Suits * 4);

        for (var hand = 0; hand < DdsLayout.Hands; hand++) {
            for (var suit = 0; suit < DdsLayout.Suits; suit++) {
                key.Append(deal[hand, suit].ToString("x4"));
            }
        }

        return key.ToString();
    }


    /// <summary>Turns the solved table into the model's own, in the model's own order.</summary>
    public static DoubleDummyTable ToTable(DdsTableResults results) {
        var tricks = new int[DdsLayout.Hands, DdsLayout.Denominations];

        for (var seat = 0; seat < DdsLayout.Hands; seat++) {
            for (var index = 0; index < DoubleDummyTable.Denominations.Length; index++) {
                tricks[seat, index] = results[ToDdsDenomination(DoubleDummyTable.Denominations[index]), seat];
            }
        }

        return new DoubleDummyTable(tricks);
    }


    /// <summary>Reads out the par contracts DDS filled in, leaving the rest of the fixed size array alone.</summary>
    public static IReadOnlyList<ParContract> ToParContracts(DdsParResults par) {
        var count = Math.Clamp(par.Number, 0, DdsLayout.ParContracts);
        var contracts = new List<ParContract>(count);

        for (var i = 0; i < count; i++) {
            contracts.Add(ToParContract(par.Contracts[i]));
        }

        return contracts;
    }


    /// <summary>Ours run clubs to spades, the solver's run spades to clubs.</summary>
    public static int ToDdsSuit(CardColor color) => 3 - (int)color;


    /// <summary>The index of a denomination in the trick table: spades, hearts, diamonds, clubs, then no trump.</summary>
    public static int ToDdsDenomination(BidColor color) {
        return color switch {
            BidColor.NoTrump => 4,
            BidColor.Spades => 0,
            BidColor.Hearts => 1,
            BidColor.Diamonds => 2,
            BidColor.Clubs => 3,
            _ => throw new ArgumentOutOfRangeException(nameof(color), color, "Only a denomination that can be bid has a double dummy result.")
        };
    }


    /// <summary>0 none, 1 both, 2 north-south, 3 east-west. Not an order anything else in the library uses.</summary>
    public static int ToDdsVulnerability(Vulnerability vulnerability) {
        return vulnerability switch {
            Vulnerability.None => 0,
            Vulnerability.Both => 1,
            Vulnerability.NorthSouth => 2,
            Vulnerability.EastWest => 3,
            _ => throw new ArgumentOutOfRangeException(nameof(vulnerability), vulnerability, "Unknown vulnerability.")
        };
    }


    private static uint ToHolding(IEnumerable<Card> cards) {
        return cards.Aggregate(0u, (holding, card) => holding | (1u << ((int)card.Value + DdsLayout.DeuceBit)));
    }


    private static ParContract ToParContract(DdsContract contract) {
        var (pair, declarer) = ToSeats(contract.Seats);
        return new ParContract(pair, declarer, contract.Level, ToBidColor(contract.Denomination), contract.OverTricks, contract.UnderTricks);
    }


    /// <summary>The denomination of a par contract: no trump first, then spades down to clubs.</summary>
    private static BidColor ToBidColor(int denomination) {
        return denomination switch {
            0 => BidColor.NoTrump,
            1 => BidColor.Spades,
            2 => BidColor.Hearts,
            3 => BidColor.Diamonds,
            4 => BidColor.Clubs,
            _ => throw new ArgumentOutOfRangeException(nameof(denomination), denomination, "DDS reported a denomination that does not exist.")
        };
    }


    /// <summary>
    /// Who plays the par contract. DDS names a single seat when only that hand can declare it, and names the pair when
    /// either hand does - so the seat is the exception rather than the rule.
    /// </summary>
    private static (Pair Pair, PlayerPosition? Declarer) ToSeats(int seats) {
        return seats switch {
            0 => (Pair.NorthSouth, PlayerPosition.North),
            1 => (Pair.EastWest, PlayerPosition.East),
            2 => (Pair.NorthSouth, PlayerPosition.South),
            3 => (Pair.EastWest, PlayerPosition.West),
            4 => (Pair.NorthSouth, null),
            5 => (Pair.EastWest, null),
            _ => throw new ArgumentOutOfRangeException(nameof(seats), seats, "DDS reported a seat that does not exist.")
        };
    }
}
