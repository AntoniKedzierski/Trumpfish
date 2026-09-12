using Model.DoubleDummy;
using Model.Enums;

namespace Trumpfish.Server.Contracts;

/// <summary>
/// One deal to solve. The deal travels in the very shape the simulator already takes, so whatever the client is holding -
/// a simulated deal, a finished practice deal - can be sent straight on without being rebuilt.
/// <paramref name="Vulnerability"/> is what par is calculated at; it defaults to nobody vulnerable, which is also what the
/// application assumes everywhere else, since it does not model a scoring session.
/// </summary>
public record DoubleDummyRequest(SimulationDealRequest Deal, Vulnerability? Vulnerability = null, DoubleDummyBid? Contract = null);

/// <summary>
/// The contract an auction actually reached. Optional: without it the deal is still solved, only nothing can be said about
/// what the bidding cost, since there is no bidding to compare against.
/// </summary>
public record DoubleDummyBid(PlayerPosition Declarer, int Level, BidColor Color, bool IsDoubled = false, bool IsRedoubled = false);

/// <summary>
/// One cell of the table: what one seat takes declaring one denomination, and the two readings of it worth showing beside
/// the count. Both are worked out here rather than in the client, which only has to draw whichever of the three is asked
/// for.
/// </summary>
/// <param name="Level">The contract those tricks are worth bidding, at any level. Null under seven tricks, where there is nothing to bid.</param>
/// <param name="Down">
/// How far this seat would go down taking the auction away in this denomination, at the cheapest level that would have
/// outranked the contract that won it. Only the defending side has an answer; null for everyone else.
/// </param>
public record DoubleDummyCell(PlayerPosition Declarer, BidColor Color, int Tricks, int? Level, int? Down);

/// <summary>
/// A contract that reaches par. <paramref name="Declarer"/> is only set when just one of the pair's two hands can play it;
/// <paramref name="Pair"/> always answers the question of who should be declaring.
/// </summary>
public record DoubleDummyContract(
    Pair Pair,
    PlayerPosition? Declarer,
    int Level,
    BidColor Color,
    int Tricks,
    int OverTricks,
    int UnderTricks,
    bool IsSacrifice,
    string Label);

/// <summary>
/// The most profitable contract one pair could declare, scored for that pair alone.
/// </summary>
/// <param name="Score">Points to this pair. Negative where the best it can do is go down in the contract, or concede the opponents'.</param>
/// <param name="IsDefence">
/// True when the contract described belongs to the <em>opponents</em>: this pair has nothing worth buying and nothing
/// worth sacrificing with, so conceding is the least it can lose.
/// </param>
public record DoubleDummyBestContract(
    Pair Pair,
    PlayerPosition Declarer,
    int Level,
    BidColor Color,
    int Tricks,
    int Score,
    bool IsSacrifice,
    bool IsDefence,
    string Label);

/// <summary>
/// The contract the auction reached, played out double dummy: what it really does against perfect defence.
/// </summary>
/// <param name="UnderTricks">How far it goes down, or zero when it makes. The part of a bad result the pair paid for directly.</param>
/// <param name="Score">Points to the declaring side, so a contract that goes down is negative.</param>
public record DoubleDummyPlayed(
    Pair Pair,
    PlayerPosition Declarer,
    int Level,
    BidColor Color,
    int Tricks,
    int UnderTricks,
    int Score);

/// <summary>
/// What the solver found. <paramref name="Table"/> is all twenty results, <paramref name="ParScore"/> is signed from
/// north-south's point of view, and <paramref name="Best"/> is the single contract to show when there is only room for one.
/// <paramref name="BestNs"/> and <paramref name="BestEw"/> answer a different question from par: not what the board is
/// worth, but what each pair would get if it were the one declaring.
/// </summary>
/// <param name="DiffNs">
/// What the auction cost north-south, with the one thing they could most usefully have done instead. Null when no contract
/// was sent, or when nothing they could legally have done was on offer.
/// </param>
/// <param name="DiffEw">The same for east-west.</param>
public record DoubleDummyResponse(
    PlayerPosition Dealer,
    Vulnerability Vulnerability,
    IReadOnlyList<DoubleDummyCell> Table,
    int ParScore,
    Pair? ParPair,
    DoubleDummyContract? Best,
    IReadOnlyList<DoubleDummyContract> ParContracts,
    DoubleDummyBestContract? BestNs,
    DoubleDummyBestContract? BestEw,
    DoubleDummyDifference? DiffNs,
    DoubleDummyDifference? DiffEw,
    DoubleDummyPlayed? Played);

/// <summary>What the auction cost one pair, and the alternative it is measured against.</summary>
/// <param name="Points">Negative for points lost. Zero when nothing available would have paid better.</param>
public record DoubleDummyDifference(Pair Pair, int Points, BiddingMiss Reason);

/// <summary>
/// What the loaded solver says about itself. Worth having its own endpoint: with a native dependency, "which library is
/// actually loaded in this container" is the first question every deployment problem comes down to.
/// </summary>
public record DoubleDummyInfo(bool Available, string? Reason, string? Version, string? Platform, int? Cores, string? Details);
