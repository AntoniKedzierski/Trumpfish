namespace Model.Bidding.Validation;

/// <summary>
/// The single bound an editor can write to make a bid carry what its own description already claims.
/// </summary>
/// <remarks>
/// Attached only where writing it would actually settle the issue - that is, where the description states a tighter bound than
/// the ranges do. Handing the client a finished instruction is what keeps it from having to recognise issues by their prose,
/// which would quietly stop working the first time a message is reworded.
/// </remarks>
/// <param name="Field">Range to write, named as the wire spells it: <c>pointsRange</c>, <c>clubsCardRange</c>, and so on.</param>
/// <param name="Bound"><c>lower</c> or <c>upper</c>.</param>
/// <param name="Value">What the description says that bound should be.</param>
public sealed record RangeRepair(string Field, string Bound, int Value);
