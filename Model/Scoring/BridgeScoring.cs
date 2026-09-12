using Model.Enums;

namespace Model.Scoring;

/// <summary>Whether a contract was doubled, and by how much.</summary>
public enum Doubling {
    None,
    Doubled,
    Redoubled
}

/// <summary>
/// What a contract is worth at duplicate, from the declaring side's point of view.
/// </summary>
/// <remarks>
/// Only what is needed to compare one contract against another on a solved deal: a contract either makes or it goes down,
/// and both sides of that are here. Honours and the rubber bonus are not - neither exists at duplicate, and nothing in this
/// application plays a rubber.
/// </remarks>
public static class BridgeScoring {

    /// <summary>What one bid trick is worth. No trump is scored a level higher for its first trick only, which <see cref="ContractPoints"/> handles.</summary>
    public static int TrickValue(BidColor denomination) => denomination switch {
        BidColor.Clubs or BidColor.Diamonds => 20,
        BidColor.Hearts or BidColor.Spades or BidColor.NoTrump => 30,
        _ => 0
    };


    /// <summary>
    /// The bid tricks alone, doubled where it applies. This is the number that decides a part score from a game, which is
    /// why a doubled two of a major is a game and an undoubled one is not.
    /// </summary>
    public static int ContractPoints(int level, BidColor denomination, Doubling doubling = Doubling.None) {
        var tricks = denomination == BidColor.NoTrump
            ? 40 + (level - 1) * 30
            : level * TrickValue(denomination);

        return tricks * Multiplier(doubling);
    }


    /// <summary>
    /// The whole score of a contract that has been played out: positive when it makes, negative when it goes down.
    /// </summary>
    /// <param name="tricks">Tricks the declaring side actually took, counting from zero - so a contract of four making needs ten.</param>
    public static int Score(int level, BidColor denomination, int tricks, bool vulnerable, Doubling doubling = Doubling.None) {
        var needed = level + 6;
        return tricks >= needed
            ? Made(level, denomination, tricks - needed, vulnerable, doubling)
            : -Penalty(needed - tricks, vulnerable, doubling);
    }


    /// <summary>A contract that makes, with any overtricks it collects on the way.</summary>
    public static int Made(int level, BidColor denomination, int overTricks, bool vulnerable, Doubling doubling = Doubling.None) {
        var contract = ContractPoints(level, denomination, doubling);

        var bonus = contract >= 100
            ? vulnerable ? 500 : 300
            : 50;

        bonus += level switch {
            6 => vulnerable ? 750 : 500,
            7 => vulnerable ? 1500 : 1000,
            _ => 0
        };

        // Doubled, an overtrick stops being worth what the denomination pays and becomes a flat penalty on the doubler.
        var overtrickValue = doubling switch {
            Doubling.Doubled => vulnerable ? 200 : 100,
            Doubling.Redoubled => vulnerable ? 400 : 200,
            _ => TrickValue(denomination)
        };

        // The bonus for being doubled and making anyway. Fifty points of insult, as the game calls it.
        var insult = doubling switch {
            Doubling.Doubled => 50,
            Doubling.Redoubled => 100,
            _ => 0
        };

        return contract + bonus + overTricks * overtrickValue + insult;
    }


    /// <summary>
    /// What a contract costs when it goes down, as a positive number of points to the defenders.
    /// </summary>
    /// <remarks>
    /// Undoubled the rate is flat. Doubled it is not: the first trick is cheap, the next two cost more, and everything past
    /// the third costs more again - which is exactly why a sacrifice has a depth beyond which it stops paying.
    /// </remarks>
    public static int Penalty(int underTricks, bool vulnerable, Doubling doubling = Doubling.None) {
        if (underTricks <= 0) {
            return 0;
        }

        if (doubling == Doubling.None) {
            return underTricks * (vulnerable ? 100 : 50);
        }

        var penalty = vulnerable
            ? 200 + (underTricks - 1) * 300
            : underTricks switch {
                1 => 100,
                2 => 300,
                _ => 500 + (underTricks - 3) * 300
            };

        return penalty * (doubling == Doubling.Redoubled ? 2 : 1);
    }


    private static int Multiplier(Doubling doubling) => doubling switch {
        Doubling.Doubled => 2,
        Doubling.Redoubled => 4,
        _ => 1
    };
}
