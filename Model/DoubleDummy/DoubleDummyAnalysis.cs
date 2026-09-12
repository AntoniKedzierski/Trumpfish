using Model.Enums;

namespace Model.DoubleDummy;

/// <summary>
/// What the solver has to say about one deal: the full table of tricks, and the par result derived from it for the dealer
/// and vulnerability the deal was played at.
/// </summary>
/// <param name="ParScore">The par score from north-south's point of view, so a positive number is east-west going wrong.</param>
/// <param name="ParContracts">
/// Every contract that reaches par. There is usually one, but a deal can have several equally good ones - the same contract
/// from either seat of a pair, or a choice between denominations.
/// </param>
public record DoubleDummyAnalysis(
    PlayerPosition Dealer,
    Vulnerability Vulnerability,
    DoubleDummyTable Table,
    int ParScore,
    IReadOnlyList<ParContract> ParContracts) {

    /// <summary>The side par favours, or null on a deal the two sides split down the middle.</summary>
    public Pair? ParPair => ParScore switch {
        > 0 => Model.Enums.Pair.NorthSouth,
        < 0 => Model.Enums.Pair.EastWest,
        _ => null
    };

    /// <summary>
    /// The contract to show when there is only room for one: the first one par found that nobody is sacrificing with.
    /// Falls back to the first par contract on a deal where the cheapest sacrifice is the par call.
    /// </summary>
    public ParContract? BestContract => ParContracts.FirstOrDefault(contract => !contract.IsSacrifice) ?? ParContracts.FirstOrDefault();
}
