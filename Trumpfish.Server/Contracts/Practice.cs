using Model.Enums;
using System.Text.Json.Serialization;

namespace Trumpfish.Server.Contracts;

/// <summary>Which side of the practised sequence the human sits on. The other side of it is played by the partner bot.</summary>
[JsonConverter(typeof(JsonStringEnumConverter<PracticeRole>))]
public enum PracticeRole {
    Opener,
    Responder
}

/// <summary>
/// Starts one practice deal. <paramref name="DealIndex"/> counts deals within a session: it decides who deals (N, E, S, W in turn)
/// and, together with <paramref name="Seed"/>, makes the whole session reproducible. <paramref name="OpeningNodeId"/> names the
/// opening being practised - the hand of whoever is meant to open it is dealt to fit it. Null practises everything.
/// <paramref name="CheckBids"/> turns on the running check of the player's own bids against the hand he is holding.
/// </summary>
public record PracticeStartRequest(Guid SystemId, int DealIndex, string? Seed, Guid? OpeningNodeId, PracticeRole Role, bool CheckBids);

/// <summary>A bid reduced to what it takes to draw it: the denomination is needed to tint the suit glyph.</summary>
public record PracticeBidLabel(BidType Type, BidColor Color, int? Value, string Label);

/// <summary>
/// Raised when a bid the player made cannot be true of the hand he is holding. <paramref name="Promised"/> is what the system
/// says that bid shows - null when the system does not have the bid at that point at all - and <paramref name="Suggested"/> is
/// what the engine would have said in his seat.
/// </summary>
public record PracticeWarning(int BidIndex, PracticeBidLabel Bid, string? Promised, string Hand, PracticeBidLabel? Suggested, string? SuggestedMeaning);

/// <summary>One bid made by the human, against the opaque state handed out with the previous answer.</summary>
public record PracticeBidRequest(string State, BidType Type, BidColor Color, int? Value);

/// <summary>Asks what the engine would bid in the player's seat. Its own request, so the answer only travels when it is wanted.</summary>
public record PracticeHintRequest(string State);

/// <summary>What the engine would say holding the player's cards. Both fields are null when it finds nothing to bid here.</summary>
public record PracticeHint(PracticeBidLabel? Bid, string? Meaning);

/// <summary>
/// What the bidding box may offer right now. <paramref name="MinimumLevel"/> gives, for every denomination, the lowest level
/// still available in it; a level of 8 means the auction has climbed past that denomination altogether.
/// </summary>
public record PracticeLegalBids(IReadOnlyDictionary<BidColor, int> MinimumLevel, bool CanDouble, bool CanRedouble);

/// <summary>
/// Where a practice deal stands. <paramref name="State"/> is opaque and signed: it carries the hands the client must not see yet,
/// and is handed straight back with the next bid. <paramref name="Result"/> only arrives once the auction is over, and is the very
/// same shape the batch simulator produces - which is what reveals all four hands and the contract. <paramref name="Warnings"/>
/// holds every bid of the player's this deal that did not fit his hand, and stays empty unless the check was asked for.
/// </summary>
public record PracticeState(
    string State,
    int DealIndex,
    PlayerPosition Dealer,
    PlayerPosition Player,
    SimulationHand PlayerHand,
    IReadOnlyList<SimulationBid> Bidding,
    IReadOnlyList<PracticeWarning> Warnings,
    bool PlayerToBid,
    PracticeLegalBids Legal,
    bool Finished,
    SimulationDealResult? Result,
    string? Error);
