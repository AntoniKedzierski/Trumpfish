using Model.Enums;
using Model.Helpers;
using Model.Scoring;

namespace Model.DoubleDummy;

/// <summary>
/// The most profitable thing one pair can do with a deal, judged from that pair's own point of view rather than from par.
/// </summary>
/// <remarks>
/// Par is one answer for the whole board - the contract that stands when neither side goes wrong - and on most deals every
/// par contract belongs to the same pair. That leaves nothing to say about the other one, which is what this fills in: what
/// each pair would get if it were the one declaring.
/// <para>
/// It is not always a contract that makes. A pair with nothing of its own may still be better off buying the contract and
/// going down in it than letting the opponents play theirs, and <see cref="Score"/> is negative when that is the case.
/// </para>
/// </remarks>
/// <param name="Pair">The pair this is about. On a defence it is <em>not</em> the pair that declares.</param>
/// <param name="Declarer">
/// The seat that plays the contract. Belongs to <paramref name="Pair"/> everywhere except a defence, where the best this
/// pair can do is let the opponents play theirs - so the contract described is the opponents'.
/// </param>
/// <param name="Score">Points to this pair, so a sacrifice and a defence are both negative. Each pair is scored for itself.</param>
/// <param name="IsDefence">
/// True when the pair has nothing worth buying and nothing worth sacrificing with, so its least bad outcome is to defend.
/// The opponents are credited with making their contract exactly - overtricks are not counted against a defender who never
/// chose to be there.
/// </param>
public record PairBest(Pair Pair, PlayerPosition Declarer, int Level, BidColor Color, int Tricks, int Score, bool IsDefence = false) {

    /// <summary>Bid to go down on purpose, because the alternative costs more.</summary>
    public bool IsSacrifice => !IsDefence && Tricks < Level + 6;

    /// <summary>The contract as it is written down, with what it does: <c>4♠</c>, <c>5♦ -2</c>, <c>3NT +1</c>.</summary>
    public string Label {
        get {
            var contract = $"{Level}{Color.ColorMark()}";
            var difference = Tricks - (Level + 6);

            return difference switch {
                < 0 => $"{contract} {difference}",
                > 0 => $"{contract} +{difference}",
                _ => contract
            };
        }
    }
}
