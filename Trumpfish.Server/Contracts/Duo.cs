using Model.Enums;
using System.Text.Json.Serialization;

namespace Trumpfish.Server.Contracts;

/// <summary>
/// Everything the host settles once for the whole session. It travels with the invitation, so the guest reads the terms before
/// agreeing to them, and is then enforced by the server for both seats - the guest client never gets to ask for more.
/// </summary>
/// <remarks>
/// There is deliberately no choice of who opens. The two players are partners, and the seat that is dealt the practised opening
/// is drawn afresh every deal, so both of them get to be the opener and the responder over a session.
/// </remarks>
public record DuoSettings(Guid SystemId, Guid? OpeningNodeId, string? Seed, bool AllowHints, bool ImmediateMeanings, bool CheckBids);

/// <summary>An outstanding invitation to a table. Lives in memory only: an invitation nobody answered is not worth keeping.</summary>
public record DuoInvitation(Guid Id, Guid FromUserId, string FromName, Guid ToUserId, string ToName, string SystemName, string? OpeningLabel, DuoSettings Settings);

/// <summary>One of the two people at the table, as the other one sees them.</summary>
public record DuoSeat(Guid UserId, string Name, PlayerPosition Position, bool Connected, bool IsHost);

/// <summary>
/// The table as one player may see it: his own hand, the auction so far, and nothing at all of the other three hands until the
/// auction is over. Built separately for each of the two players, which is what keeps the partner cards out of reach.
/// </summary>
public record DuoTableState(
    Guid SessionId,
    int DealNumber,
    PlayerPosition Dealer,
    SimulationHand Hand,
    IReadOnlyList<SimulationBid> Bidding,
    IReadOnlyList<PracticeWarning> Warnings,
    bool YourTurn,
    PracticeLegalBids Legal,
    bool Finished,
    SimulationDealResult? Result,
    string? Error,
    DuoSettings Settings,
    DuoSeat You,
    DuoSeat Partner,
    string SystemName,
    string? OpeningLabel);

/// <summary>Why a session stopped, which is what the other player is shown when it was not his doing.</summary>
[JsonConverter(typeof(JsonStringEnumConverter<DuoEndReason>))]
public enum DuoEndReason {

    /// <summary>Somebody pressed the button. The ordinary way a session ends.</summary>
    Finished,

    /// <summary>Somebody navigated away, refreshed, or closed the tab.</summary>
    PartnerLeft,

    /// <summary>Somebody connection dropped and did not come back inside the grace period.</summary>
    PartnerLost
}

/// <summary>The end of a session, sent to whoever is still at the table.</summary>
public record DuoEnded(Guid SessionId, DuoEndReason Reason, string Message);

/// <summary>What the guest sees while the host is setting the next deal up, or while a dropped partner is being waited for.</summary>
public record DuoNotice(Guid SessionId, string Message);
