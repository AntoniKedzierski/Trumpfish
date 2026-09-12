using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Model.Enums;
using Trumpfish.Server.Contracts;
using Trumpfish.Server.Services;

namespace Trumpfish.Server.Hubs;

/// <summary>
/// The one live connection every signed-in client keeps open: it carries presence, invitations and the two-player table.
/// </summary>
/// <remarks>
/// One hub rather than several because the three are the same conversation - you see a friend come online, you invite him, you
/// end up at a table with him - and a single connection is also what makes leaving unambiguous: when it closes, the person has
/// gone, whether he pressed a button, navigated away or closed the tab.
/// </remarks>
[Authorize]
public class TableHub : Hub {

    private readonly IPresenceTracker _presence;
    private readonly IDuoSessionService _sessions;
    private readonly IFriendService _friends;
    private readonly IBiddingSystemStore _store;
    private readonly IUserService _users;
    private readonly ITableNotifier _notifier;


    public TableHub(IPresenceTracker presence, IDuoSessionService sessions, IFriendService friends, IBiddingSystemStore store, IUserService users, ITableNotifier notifier) {
        _presence = presence;
        _sessions = sessions;
        _friends = friends;
        _store = store;
        _users = users;
        _notifier = notifier;
    }


    public override async Task OnConnectedAsync() {
        var userId = UserId();

        if (_presence.Connect(userId, Context.ConnectionId)) {
            await _notifier.PresenceChangedAsync(userId);
        }

        // A reconnect inside the grace period puts the player straight back at the table he had dropped out of.
        var session = _sessions.SessionOf(userId);
        if (session != null && !session.IsConnected(userId) && session.SetConnected(userId, true)) {
            await _notifier.TableAsync(session);
            await _notifier.NoticeAsync(session, session.Other(userId), "Partner wrócił do stołu.");
        }

        await base.OnConnectedAsync();
    }


    public override async Task OnDisconnectedAsync(Exception? exception) {
        var userId = UserId();
        var last = _presence.Disconnect(userId, Context.ConnectionId);

        if (last) {
            var session = _sessions.SessionOf(userId);

            if (session != null) {
                session.SetConnected(userId, false);

                // The table goes out first and the remark second: a table always clears the last remark, so the other order
                // would wipe the very thing being said.
                await _notifier.TableAsync(session);
                await _notifier.NoticeAsync(session, session.Other(userId), "Partner stracił połączenie. Czekam, aż wróci…");

                // Not awaited: the grace period outlives this connection, and nothing here is waiting on its outcome.
                _ = _notifier.WatchForReturnAsync(session, userId);
            }

            foreach (var invitation in _sessions.DropInvitationsOf(userId)) {
                await _notifier.InvitationWithdrawnAsync(invitation);
            }

            await _notifier.PresenceChangedAsync(userId);
        }

        await base.OnDisconnectedAsync(exception);
    }


    // --- Invitations ---

    /// <summary>Asks a friend to sit down at a table on the settings given. Everything about the session is settled here.</summary>
    public async Task InviteToTable(Guid friendUserId, DuoSettings settings) {
        var userId = UserId();

        if (!await _friends.AreFriendsAsync(userId, friendUserId)) {
            throw new HubException("Możesz zaprosić tylko znajomego.");
        }

        if (_sessions.SessionOf(userId) != null) {
            throw new HubException("Jesteś już przy stole. Zakończ bieżącą sesję, zanim zaprosisz kogoś innego.");
        }

        if (_presence.PresenceOf(friendUserId) != FriendPresence.Online) {
            throw new HubException("Ten znajomy jest niedostępny.");
        }

        var operation = await _store.GetAsync(settings.SystemId, userId, Context.User!.IsAdmin());
        if (operation.Result != SystemAccessResult.Success) {
            throw new HubException("Nie znaleziono systemu licytacyjnego.");
        }

        var system = operation.Value!;
        var opening = TableEngine.FindOpening(system, settings.OpeningNodeId);

        if (settings.OpeningNodeId != null && opening == null) {
            throw new HubException("Nie znaleziono ćwiczonego otwarcia w tym systemie.");
        }

        var invitation = _sessions.Invite(userId, await NameOf(userId), friendUserId, await NameOf(friendUserId), system, system.SystemName, DuoSession.DescribeOpening(opening), settings);
        await _notifier.InvitationAsync(invitation);
    }


    /// <summary>Withdraws an invitation the caller sent.</summary>
    public async Task CancelTableInvitation(Guid invitationId) {
        var offer = _sessions.TakeInvitation(invitationId, UserId());

        if (offer != null) {
            await _notifier.InvitationWithdrawnAsync(offer.Invitation);
        }
    }


    /// <summary>Accepts an invitation and seats both people. Only the account it was sent to may do this.</summary>
    public async Task AcceptTableInvitation(Guid invitationId) {
        var userId = UserId();
        var offer = _sessions.TakeInvitation(invitationId, userId);

        if (offer == null || offer.Invitation.ToUserId != userId) {
            throw new HubException("To zaproszenie już nie jest aktualne.");
        }

        var invitation = offer.Invitation;

        // Taken off the board above, so it comes off both screens now - before anything below can refuse and throw, which
        // would otherwise leave an invitation showing that no longer exists.
        await _notifier.InvitationWithdrawnAsync(invitation);

        if (_sessions.SessionOf(userId) != null || _sessions.SessionOf(invitation.FromUserId) != null) {
            throw new HubException("Jedno z was siedzi już przy innym stole.");
        }

        if (_presence.PresenceOf(invitation.FromUserId) == FriendPresence.Offline) {
            throw new HubException("Zapraszający się rozłączył.");
        }

        var session = _sessions.Start(offer);
        if (session == null) {
            throw new HubException("Nie da się rozdać ręki spełniającej warunki tego otwarcia - sprawdź zakresy punktów i kart.");
        }

        // Neither of them is invitable any more, so every other invitation either of them had goes away with the same message.
        foreach (var member in session.Members) {
            foreach (var stale in _sessions.DropInvitationsOf(member)) {
                await _notifier.InvitationWithdrawnAsync(stale);
            }
        }

        await _notifier.TableAsync(session);
        await Task.WhenAll(session.Members.Select(_notifier.PresenceChangedAsync));
    }


    /// <summary>Turns an invitation down, which takes it off the board and tells whoever sent it.</summary>
    public async Task DeclineTableInvitation(Guid invitationId) {
        var offer = _sessions.TakeInvitation(invitationId, UserId());

        if (offer != null) {
            await _notifier.InvitationWithdrawnAsync(offer.Invitation, $"{offer.Invitation.ToName} odrzucił zaproszenie.");
        }
    }


    // --- The table ---

    /// <summary>The table as it stands, asked for after a reconnect or a reload.</summary>
    public DuoTableState? Table() {
        return _sessions.SessionOf(UserId())?.StateFor(UserId());
    }


    public Task Bid(BidType type, BidColor color, int? value) {
        var (session, userId) = Seated();
        return Answer(session.Bid(userId, new PracticeStoredBid(type, color, value)), () => _notifier.TableAsync(session));
    }


    /// <summary>What the engine would bid holding the callers cards. Only ever answered to the person who asked.</summary>
    public PracticeHint Hint() {
        var (session, userId) = Seated();
        var (result, hint) = session.Hint(userId);

        return result == DuoResult.Success && hint != null ? hint : throw new HubException(Explain(result));
    }


    /// <summary>Deals the next hand. The hosts call, so the guest is never taken off a summary he is still reading.</summary>
    public Task NextDeal() {
        var (session, userId) = Seated();
        return Answer(session.NextDeal(userId), () => _notifier.TableAsync(session));
    }


    /// <summary>Ends the session on purpose. Either of them may do it, and both are shown the closing screen.</summary>
    public Task EndTable() {
        var (session, _) = Seated();
        return _notifier.EndAsync(session, DuoEndReason.Finished, "Sesja została zakończona.");
    }


    private (DuoSession Session, Guid UserId) Seated() {
        var userId = UserId();
        var session = _sessions.SessionOf(userId) ?? throw new HubException("Nie siedzisz przy żadnym stole.");

        return (session, userId);
    }


    private static Task Answer(DuoResult result, Func<Task> onSuccess) {
        return result == DuoResult.Success ? onSuccess() : throw new HubException(Explain(result));
    }


    private static string Explain(DuoResult result) {
        return result switch {
            DuoResult.WrongMoment => "To nie jest teraz twoja kolej.",
            DuoResult.IllegalBid => "Ta odzywka jest nielegalna w tym miejscu licytacji.",
            DuoResult.HostOnly => "Następne rozdanie rozdaje osoba, która założyła sesję.",
            DuoResult.NotAllowed => "Podpowiedzi silnika są w tej sesji wyłączone.",
            DuoResult.CannotDeal => "Nie da się rozdać ręki spełniającej warunki tego otwarcia - sprawdź zakresy punktów i kart.",
            _ => "Nie siedzisz przy żadnym stole."
        };
    }


    /// <summary>How an account is named to the other side of a table. The cookie only carries the username, so the record decides.</summary>
    private async Task<string> NameOf(Guid userId) {
        var user = await _users.FindByIdAsync(userId);
        return user?.DisplayName ?? user?.Username ?? "Partner";
    }


    private Guid UserId() {
        return Context.User!.RequireUserId();
    }
}
