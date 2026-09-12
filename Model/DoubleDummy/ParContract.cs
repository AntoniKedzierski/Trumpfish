using Model.Enums;
using Model.Helpers;

namespace Model.DoubleDummy;

/// <summary>
/// One contract of the par result: what the deal is worth when neither side makes a mistake, in the bidding or in the play.
/// A par contract is not always a making one - when the opponents have the better contract, the par call is the cheapest
/// sacrifice against it, which is why <see cref="UnderTricks"/> exists alongside <see cref="OverTricks"/>.
/// </summary>
/// <param name="Pair">The side that plays the contract. This is the answer to "who should be declaring".</param>
/// <param name="Declarer">
/// The seat that has to declare it, when only one of the pair's two hands can. Null when either hand does equally well,
/// which is the common case.
/// </param>
/// <param name="OverTricks">Tricks taken above the contract. Par never overbids, so this is only non-zero for a contract that cannot be raised profitably.</param>
/// <param name="UnderTricks">Tricks the contract goes down by - non-zero exactly when it is a sacrifice.</param>
public record ParContract(Pair Pair, PlayerPosition? Declarer, int Level, BidColor Color, int OverTricks, int UnderTricks) {

    /// <summary>A contract bid to go down on purpose, because the opponents' contract is worth more than the penalty.</summary>
    public bool IsSacrifice => UnderTricks > 0;

    /// <summary>Tricks the declaring side actually takes.</summary>
    public int Tricks => Level + 6 + OverTricks - UnderTricks;

    /// <summary>The contract as it is written down: <c>4♠</c>, <c>5♢ -2</c>, <c>3NT +1</c>.</summary>
    public string Label {
        get {
            var contract = $"{Level}{Color.ColorMark()}";

            if (UnderTricks > 0) {
                return $"{contract} -{UnderTricks}";
            }

            return OverTricks > 0 ? $"{contract} +{OverTricks}" : contract;
        }
    }
}
