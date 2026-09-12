using Model.Enums;

namespace Trumpfish.Server.Contracts;

/// <summary>
/// One deal to solve. The deal travels in the very shape the simulator already takes, so whatever the client is holding -
/// a simulated deal, a finished practice deal - can be sent straight on without being rebuilt.
/// <paramref name="Vulnerability"/> is what par is calculated at; it defaults to nobody vulnerable, which is also what the
/// application assumes everywhere else, since it does not model a scoring session.
/// </summary>
public record DoubleDummyRequest(SimulationDealRequest Deal, Vulnerability? Vulnerability = null);

/// <summary>One cell of the table: what one seat takes declaring one denomination.</summary>
public record DoubleDummyTricks(PlayerPosition Declarer, BidColor Color, int Tricks);

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
/// What the solver found. <paramref name="Table"/> is all twenty results, <paramref name="ParScore"/> is signed from
/// north-south's point of view, and <paramref name="Best"/> is the single contract to show when there is only room for one.
/// </summary>
public record DoubleDummyResponse(
    PlayerPosition Dealer,
    Vulnerability Vulnerability,
    IReadOnlyList<DoubleDummyTricks> Table,
    int ParScore,
    Pair? ParPair,
    DoubleDummyContract? Best,
    IReadOnlyList<DoubleDummyContract> ParContracts);

/// <summary>
/// What the loaded solver says about itself. Worth having its own endpoint: with a native dependency, "which library is
/// actually loaded in this container" is the first question every deployment problem comes down to.
/// </summary>
public record DoubleDummyInfo(bool Available, string? Reason, string? Version, string? Platform, int? Cores, string? Details);
