using Microsoft.AspNetCore.SignalR;
using Trumpfish.Server.Contracts;
using Trumpfish.Server.Hubs;

namespace Trumpfish.Server.Services;

/// <summary>
/// Every message the server sends of its own accord, in one place. Both the hub - which answers what a client asked for - and
/// the background work that outlives a connection go through it, so a table change is fanned out the same way whoever caused it.
/// </summary>
public interface ITableNotifier {

    /// <summary>Tells the named accounts their friend list has changed, so they fetch it again.</summary>
    Task FriendsChangedAsync(params IReadOnlyCollection<Guid> userIds);

    /// <summary>Tells everybody who has this account as a friend that it came online, went offline or sat down at a table.</summary>
    Task PresenceChangedAsync(Guid userId);

    Task InvitationAsync(DuoInvitation invitation);

    /// <summary>Withdraws an invitation from the screen of whoever had it, whether it was cancelled, answered or timed out.</summary>
    Task InvitationWithdrawnAsync(DuoInvitation invitation, string? message = null);

    /// <summary>Sends both people at a table their own view of it. Each one only ever gets his own hand.</summary>
    Task TableAsync(DuoSession session);

    /// <summary>Passes a one-off remark to one person at a table - that his partner dropped out, and is being waited for.</summary>
    Task NoticeAsync(DuoSession session, Guid userId, string message);

    /// <summary>Breaks a table up and tells whoever is still at it. Does nothing when it has already been broken up.</summary>
    Task EndAsync(DuoSession session, DuoEndReason reason, string message, Guid? except = null);

    /// <summary>Waits out the grace period for a dropped player and, if he has not come back, ends the table for the other one.</summary>
    Task WatchForReturnAsync(DuoSession session, Guid userId);
}


public class TableNotifier : ITableNotifier {

    /// <summary>
    /// How long a dropped connection is given to come back. Long enough for a reload or a lost signal, short enough that the
    /// other player is not left staring at a table nobody is coming back to.
    /// </summary>
    private static readonly TimeSpan Grace = TimeSpan.FromSeconds(20);

    private readonly IHubContext<TableHub> _hub;
    private readonly IPresenceTracker _presence;
    private readonly IDuoSessionService _sessions;
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<TableNotifier> _log;


    public TableNotifier(IHubContext<TableHub> hub, IPresenceTracker presence, IDuoSessionService sessions, IServiceScopeFactory scopes, ILogger<TableNotifier> log) {
        _hub = hub;
        _presence = presence;
        _sessions = sessions;
        _scopes = scopes;
        _log = log;
    }


    public Task FriendsChangedAsync(params IReadOnlyCollection<Guid> userIds) {
        return Task.WhenAll(userIds.Distinct().Select(userId => To(userId).SendAsync("friendsChanged")));
    }


    public async Task PresenceChangedAsync(Guid userId) {
        // Presence is only ever shown to friends, so the list of who to tell has to come out of the database.
        using var scope = _scopes.CreateScope();
        var friends = await scope.ServiceProvider.GetRequiredService<IFriendService>().FriendIdsAsync(userId);

        await Task.WhenAll(friends.Select(friend => To(friend).SendAsync("presenceChanged", userId, _presence.PresenceOf(userId))));
    }


    public Task InvitationAsync(DuoInvitation invitation) {
        return To(invitation.ToUserId).SendAsync("tableInvitation", invitation);
    }


    public Task InvitationWithdrawnAsync(DuoInvitation invitation, string? message = null) {
        // Both sides: the invited one so the banner goes away, and the inviting one so he learns his invitation is dead - it is
        // he who is left waiting on it, and a refusal that only reached the person refusing would tell nobody anything.
        return Task.WhenAll(
            To(invitation.ToUserId).SendAsync("tableInvitationWithdrawn", invitation.Id, message),
            To(invitation.FromUserId).SendAsync("tableInvitationWithdrawn", invitation.Id, message));
    }


    public Task TableAsync(DuoSession session) {
        // Built once per person rather than once per table: the state carries a hand, and the wrong hand would give the deal away.
        return Task.WhenAll(session.Members.Select(member => To(member).SendAsync("table", session.StateFor(member))));
    }


    public Task NoticeAsync(DuoSession session, Guid userId, string message) {
        return To(userId).SendAsync("tableNotice", new DuoNotice(session.Id, message));
    }


    public async Task EndAsync(DuoSession session, DuoEndReason reason, string message, Guid? except = null) {
        if (!_sessions.End(session.Id)) {
            return;
        }

        var ended = new DuoEnded(session.Id, reason, message);
        await Task.WhenAll(session.Members.Where(member => member != except).Select(member => To(member).SendAsync("tableEnded", ended)));

        // Both of them stop being busy the moment the table goes, so their friends can invite them again.
        await Task.WhenAll(session.Members.Select(PresenceChangedAsync));
    }


    public async Task WatchForReturnAsync(DuoSession session, Guid userId) {
        try {
            await Task.Delay(Grace);

            // Still the same table, and he is still not back: nobody is coming, so the other one is let go.
            if (_sessions.Session(session.Id) != null && !session.IsConnected(userId)) {
                await EndAsync(session, DuoEndReason.PartnerLost, "Partner stracił połączenie i nie wrócił. Sesja została zamknięta.", userId);
            }
        }
        catch (Exception exception) {
            _log.LogWarning(exception, "Failed to close duo session {Session} after a lost connection.", session.Id);
        }
    }


    private IClientProxy To(Guid userId) {
        return _hub.Clients.Clients(_presence.ConnectionsOf(userId));
    }
}
