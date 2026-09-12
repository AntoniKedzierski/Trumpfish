using Model.Enums;

namespace Model.DoubleDummy;

/// <summary>
/// One cell of the trick table as it is read, rather than as it is stored.
/// </summary>
/// <remarks>
/// <see cref="DoubleDummyEntry"/> is the number the solver returned; this is the three things worth saying about it, and
/// all three are worked out here so that whatever draws the table has nothing left to decide.
/// </remarks>
/// <param name="Tricks">What this seat takes declaring this denomination.</param>
/// <param name="Level">
/// The contract those tricks are worth bidding. Null under seven tricks, where there is no contract to bid at all - and
/// set at every level above that, game or not: a part score is still what this pair would be playing.
/// </param>
/// <param name="Down">
/// How far this seat would go down having taken the auction away in this denomination, bidding it at the cheapest level
/// that would have outranked the contract that won. Zero where it would make instead.
/// <para>
/// Only the side that did not buy the contract has an answer: the side that did cannot take the auction away from itself.
/// Null too on a board with no contract, and where no level of this denomination would have outranked the one bought.
/// </para>
/// </param>
public record TableCell(PlayerPosition Declarer, BidColor Denomination, int Tricks, int? Level, int? Down);
