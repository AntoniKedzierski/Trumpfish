using Model.Enums;

namespace Trumpfish.Server.Contracts;

/// <summary>A single card as transported over the wire. The client generates deals, the server only rebuilds <see cref="Model.Card"/> instances.</summary>
public record SimulationCard(CardValue Value, CardColor Color, string Label);

/// <summary>One of the four hands sent by the client for a deal.</summary>
public record SimulationHandRequest(PlayerPosition Position, IReadOnlyList<SimulationCard> Cards);

/// <summary>A deal generated on the client: the dealer plus all four hands.</summary>
public record SimulationDealRequest(PlayerPosition Dealer, IReadOnlyList<SimulationHandRequest> Hands);

/// <summary>
/// Batch of deals to simulate with the given bidding system. <paramref name="Seed"/> is the (optional) seed the client used to generate the deals -
/// reusing it reproduces exactly the same deals, which makes a run debuggable. When it is null the deals were truly random.
/// </summary>
public record SimulationRequest(string SystemName, IReadOnlyList<SimulationDealRequest> Deals, string? Seed = null);

/// <summary>Hand echoed back together with everything the client needs to render it.</summary>
public record SimulationHand(PlayerPosition Position, IReadOnlyList<SimulationCard> Cards, int Points, int PointsNt, int Spades, int Hearts, int Diamonds, int Clubs);

/// <summary>A single entry of the auction, already attributed to the player who made it.</summary>
public record SimulationBid(int Index, PlayerPosition Bidder, BidType Type, BidColor Color, int? Value, bool IsFromSystem, string Label);

/// <summary>
/// Final contract of a simulated auction. <paramref name="PairPoints"/> is the combined strength of the declaring pair - honour points for a suit contract,
/// no-trump points for a no-trump one - and <paramref name="TrumpCount"/> is the pair's trump fit, only set for suit contracts.
/// </summary>
public record SimulationContract(bool Passed, PlayerPosition? Declarer, int? Value, BidColor Color, bool IsDoubled, bool IsRedoubled, string Label, int? PairPoints, int? TrumpCount);

/// <summary>Result of simulating one deal. <paramref name="Error"/> is set when the engine could not finish the auction.</summary>
public record SimulationDealResult(int Index, PlayerPosition Dealer, IReadOnlyList<SimulationHand> Hands, IReadOnlyList<SimulationBid> Bidding, SimulationContract Contract, string? Error);

/// <summary>Result of a whole simulation batch.</summary>
public record SimulationResponse(string SystemName, int DealCount, int FailedCount, IReadOnlyList<SimulationDealResult> Deals, string? Seed = null);
