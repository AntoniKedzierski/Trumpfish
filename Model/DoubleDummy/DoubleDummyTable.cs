using Model.Enums;
using Model.Helpers;

namespace Model.DoubleDummy;

/// <summary>
/// How many tricks each of the four hands takes as declarer in each of the five denominations, with all four hands played
/// open and every card played optimally. Twenty numbers, and the whole double dummy truth about a deal - par, the best
/// contract for either pair and how badly an auction missed are all read off this table.
/// </summary>
public class DoubleDummyTable {

    /// <summary>The denominations in the order this table stores them, lowest ranking first.</summary>
    public static readonly BidColor[] Denominations = [BidColor.Clubs, BidColor.Diamonds, BidColor.Hearts, BidColor.Spades, BidColor.NoTrump];

    /// <summary>Tricks indexed by declarer and by the position of the denomination in <see cref="Denominations"/>.</summary>
    private readonly int[,] _tricks;


    /// <param name="tricks">A four by five array: the first index is the declarer, the second indexes <see cref="Denominations"/>.</param>
    public DoubleDummyTable(int[,] tricks) {
        if (tricks.GetLength(0) != 4 || tricks.GetLength(1) != 5) {
            throw new ArgumentException("A double dummy table has four declarers and five denominations.", nameof(tricks));
        }

        _tricks = tricks;
    }


    /// <summary>Tricks the given hand takes declaring in the given denomination.</summary>
    public int Tricks(PlayerPosition declarer, BidColor denomination) => _tricks[(int)declarer, IndexOf(denomination)];


    /// <summary>
    /// Tricks the pair takes in the given denomination, from whichever of its two hands does better. Declaring from the
    /// right side is worth a trick often enough that the two seats have to be asked separately.
    /// </summary>
    public int Tricks(Pair pair, BidColor denomination) {
        var seats = pair.Seats();
        return Math.Max(Tricks(seats[0], denomination), Tricks(seats[1], denomination));
    }


    /// <summary>The highest level the pair makes in the given denomination, or zero when it does not make even one.</summary>
    public int MakeableLevel(Pair pair, BidColor denomination) => Math.Max(0, Tricks(pair, denomination) - 6);


    /// <summary>The seat of the pair that should declare the given denomination. The two are equal often enough that ties go to the first seat.</summary>
    public PlayerPosition BetterSeat(Pair pair, BidColor denomination) {
        var seats = pair.Seats();
        return Tricks(seats[1], denomination) > Tricks(seats[0], denomination) ? seats[1] : seats[0];
    }


    /// <summary>The whole table, declarer by declarer, for a client that wants to draw it.</summary>
    public IEnumerable<DoubleDummyEntry> Entries() {
        foreach (var declarer in Enum.GetValues<PlayerPosition>()) {
            foreach (var denomination in Denominations) {
                yield return new DoubleDummyEntry(declarer, denomination, Tricks(declarer, denomination));
            }
        }
    }


    private static int IndexOf(BidColor denomination) {
        var index = Array.IndexOf(Denominations, denomination);
        if (index < 0) {
            throw new ArgumentOutOfRangeException(nameof(denomination), denomination, "A double dummy table is only defined for the five denominations that can be bid.");
        }

        return index;
    }
}


/// <summary>One cell of a <see cref="DoubleDummyTable"/>.</summary>
public record DoubleDummyEntry(PlayerPosition Declarer, BidColor Denomination, int Tricks);
