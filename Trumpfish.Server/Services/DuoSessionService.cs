using Model.Bidding.AI;
using System.Collections.Concurrent;
using Trumpfish.Server.Contracts;

namespace Trumpfish.Server.Services;

/// <summary>
/// An invitation together with the tree it was issued against. The system is resolved while the host - who owns it, and whose
/// rights decide whether it may be read at all - is the one making the request, and then travels with the invitation: the
/// guest never has to be able to read it himself, and never sees it.
/// </summary>
public record DuoOffer(DuoInvitation Invitation, BiddingSystem System);


public interface IDuoSessionService {

    /// <summary>Records an invitation to a table, replacing any the same pair already had outstanding.</summary>
    DuoInvitation Invite(Guid fromId, string fromName, Guid toId, string toName, BiddingSystem system, string systemName, string? openingLabel, DuoSettings settings);

    /// <summary>Takes an invitation off the board. Only the two accounts it names may do so, which is what makes it theirs to answer.</summary>
    DuoOffer? TakeInvitation(Guid invitationId, Guid userId);

    /// <summary>Every invitation waiting for an account, which is what a client shows after a reload.</summary>
    IReadOnlyList<DuoInvitation> InvitationsFor(Guid userId);

    /// <summary>Drops every invitation an account sent or was sent, used when it goes offline or sits down at a table.</summary>
    IReadOnlyList<DuoInvitation> DropInvitationsOf(Guid userId);

    /// <summary>Seats the two people from an accepted invitation. Null when no hand satisfying the practised opening can be dealt.</summary>
    DuoSession? Start(DuoOffer offer);

    /// <summary>The table an account is sitting at, or null when it is not at one.</summary>
    DuoSession? SessionOf(Guid userId);

    DuoSession? Session(Guid sessionId);

    /// <summary>Breaks a table up. Returns false when it had already been broken up, so the end is only announced once.</summary>
    bool End(Guid sessionId);
}


/// <summary>
/// The live tables and the invitations to them, held in memory for the lifetime of the process.
/// </summary>
/// <remarks>
/// Deliberately not persisted. A session only exists while both people are connected to it - leaving, reloading or losing the
/// connection for good ends it - so there is nothing worth surviving a restart, and nothing to sweep up afterwards. It does
/// mean the application has to run as a single instance; scaling out would need a SignalR backplane and a shared store.
/// </remarks>
public class DuoSessionService : IDuoSessionService {

    private readonly ConcurrentDictionary<Guid, DuoOffer> _invitations = new();
    private readonly ConcurrentDictionary<Guid, DuoSession> _sessions = new();

    /// <summary>Account to the table it sits at. Nobody sits at two, so this is what refuses a second invitation.</summary>
    private readonly ConcurrentDictionary<Guid, Guid> _seated = new();

    private readonly IPresenceTracker _presence;


    public DuoSessionService(IPresenceTracker presence) {
        _presence = presence;
    }


    public DuoInvitation Invite(Guid fromId, string fromName, Guid toId, string toName, BiddingSystem system, string systemName, string? openingLabel, DuoSettings settings) {
        // Asking again replaces the earlier ask rather than piling up: the settings may well have changed in between.
        foreach (var stale in _invitations.Values.Where(candidate => candidate.Invitation.FromUserId == fromId && candidate.Invitation.ToUserId == toId)) {
            _invitations.TryRemove(stale.Invitation.Id, out _);
        }

        var invitation = new DuoInvitation(Guid.NewGuid(), fromId, fromName, toId, toName, systemName, openingLabel, settings);
        _invitations[invitation.Id] = new DuoOffer(invitation, system);

        return invitation;
    }


    public DuoOffer? TakeInvitation(Guid invitationId, Guid userId) {
        if (!_invitations.TryGetValue(invitationId, out var offer) || (offer.Invitation.FromUserId != userId && offer.Invitation.ToUserId != userId)) {
            return null;
        }

        return _invitations.TryRemove(invitationId, out var taken) ? taken : null;
    }


    public IReadOnlyList<DuoInvitation> InvitationsFor(Guid userId) {
        return [.. _invitations.Values.Select(offer => offer.Invitation).Where(invitation => invitation.ToUserId == userId)];
    }


    public IReadOnlyList<DuoInvitation> DropInvitationsOf(Guid userId) {
        var dropped = _invitations.Values.Select(offer => offer.Invitation).Where(invitation => invitation.FromUserId == userId || invitation.ToUserId == userId).ToList();

        foreach (var invitation in dropped) {
            _invitations.TryRemove(invitation.Id, out _);
        }

        return dropped;
    }


    public DuoSession? Start(DuoOffer offer) {
        var invitation = offer.Invitation;
        var deal = DuoSession.Deal(offer.System, invitation.Settings, 0);

        if (deal == null) {
            return null;
        }

        var session = new DuoSession(Guid.NewGuid(), offer.System, invitation.SystemName, invitation.OpeningLabel, invitation.Settings, invitation.FromUserId, invitation.FromName, invitation.ToUserId, invitation.ToName, deal);
        _sessions[session.Id] = session;

        foreach (var member in session.Members) {
            _seated[member] = session.Id;

            // Both of them show up as busy to their friends from here on, so nobody invites somebody who is already playing.
            _presence.SetBusy(member, true);
        }

        return session;
    }


    public DuoSession? SessionOf(Guid userId) {
        return _seated.TryGetValue(userId, out var sessionId) ? Session(sessionId) : null;
    }


    public DuoSession? Session(Guid sessionId) {
        return _sessions.TryGetValue(sessionId, out var session) ? session : null;
    }


    public bool End(Guid sessionId) {
        if (!_sessions.TryRemove(sessionId, out var session)) {
            return false;
        }

        foreach (var member in session.Members) {
            // Only if they are still seated here: a slow end must not unseat somebody who has already started another table.
            _seated.TryRemove(new KeyValuePair<Guid, Guid>(member, sessionId));
            _presence.SetBusy(member, false);
        }

        return true;
    }
}
