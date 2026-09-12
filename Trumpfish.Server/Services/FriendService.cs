using Microsoft.EntityFrameworkCore;
using Trumpfish.Server.Contracts;
using Trumpfish.Server.Data;

namespace Trumpfish.Server.Services;

/// <summary>Why a friendship command was refused, so the controller can pick a status code without knowing the rules.</summary>
public enum FriendResult {
    Success,

    /// <summary>No account carries that name.</summary>
    UnknownUser,

    /// <summary>An account cannot befriend itself.</summary>
    Self,

    /// <summary>The two are already friends, or an invitation between them is already outstanding.</summary>
    AlreadyExists,

    /// <summary>There is no such invitation or friendship to act on - or it belongs to somebody else.</summary>
    NotFound
}

/// <summary>Outcome of a friendship command, together with the other account when the command names one.</summary>
public record FriendOperation(FriendResult Result, Guid? OtherUserId = null) {

    public static FriendOperation Ok(Guid otherUserId) => new(FriendResult.Success, otherUserId);

    public static FriendOperation Fail(FriendResult result) => new(result);
}


public interface IFriendService {

    /// <summary>The whole dropdown: accepted friends with their presence, plus invitations waiting on either side.</summary>
    Task<FriendsView> ViewAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>Every account that is already a friend. Used to decide who to tell when somebody comes online.</summary>
    Task<IReadOnlyList<Guid>> FriendIdsAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>Whether the two accounts are friends, which is what a table invitation requires.</summary>
    Task<bool> AreFriendsAsync(Guid first, Guid second, CancellationToken cancellationToken = default);

    Task<FriendOperation> InviteAsync(Guid userId, string username, CancellationToken cancellationToken = default);

    /// <summary>Accepts an invitation. Only the account it was sent to may do this.</summary>
    Task<FriendOperation> AcceptAsync(Guid userId, Guid friendshipId, CancellationToken cancellationToken = default);

    /// <summary>Removes a friendship or an invitation from either side, which both sides are allowed to do.</summary>
    Task<FriendOperation> RemoveAsync(Guid userId, Guid friendshipId, CancellationToken cancellationToken = default);
}


/// <summary>
/// Friendships over the single symmetric row <see cref="FriendshipRecord"/> keeps. Every read looks for the account on both
/// sides of the pair, so which side originally asked stops mattering the moment the invitation is accepted.
/// </summary>
public class FriendService : IFriendService {

    private readonly TrumpfishDbContext _context;
    private readonly IPresenceTracker _presence;


    public FriendService(TrumpfishDbContext context, IPresenceTracker presence) {
        _context = context;
        _presence = presence;
    }


    public async Task<FriendsView> ViewAsync(Guid userId, CancellationToken cancellationToken = default) {
        var rows = await Involving(userId).Include(row => row.Requester).Include(row => row.Addressee).AsNoTracking().ToListAsync(cancellationToken);

        var friends = new List<FriendSummary>();
        var incoming = new List<FriendSummary>();
        var outgoing = new List<FriendSummary>();

        foreach (var row in rows) {
            var mine = row.RequesterId == userId;
            var other = mine ? row.Addressee : row.Requester;

            if (other == null) {
                continue;
            }

            var state = row.Status == FriendshipStatus.Accepted ? FriendshipState.Friend : mine ? FriendshipState.Outgoing : FriendshipState.Incoming;
            var summary = new FriendSummary(row.Id, other.Id, other.Username, other.DisplayName, state, _presence.PresenceOf(other.Id));

            (state switch { FriendshipState.Friend => friends, FriendshipState.Incoming => incoming, _ => outgoing }).Add(summary);
        }

        // Whoever can be played with right now comes first; the rest keep a stable alphabetical order.
        friends.Sort((left, right) => left.Presence == right.Presence
            ? string.Compare(Display(left), Display(right), StringComparison.CurrentCultureIgnoreCase)
            : Rank(left.Presence).CompareTo(Rank(right.Presence)));

        return new FriendsView(friends, incoming, outgoing);
    }


    public async Task<IReadOnlyList<Guid>> FriendIdsAsync(Guid userId, CancellationToken cancellationToken = default) {
        return await Involving(userId)
            .Where(row => row.Status == FriendshipStatus.Accepted)
            .Select(row => row.RequesterId == userId ? row.AddresseeId : row.RequesterId)
            .ToListAsync(cancellationToken);
    }


    public Task<bool> AreFriendsAsync(Guid first, Guid second, CancellationToken cancellationToken = default) {
        return _context.Friendships.AnyAsync(row => row.Status == FriendshipStatus.Accepted
            && ((row.RequesterId == first && row.AddresseeId == second) || (row.RequesterId == second && row.AddresseeId == first)), cancellationToken);
    }


    public async Task<FriendOperation> InviteAsync(Guid userId, string username, CancellationToken cancellationToken = default) {
        var normalized = UserRecord.Normalize(username);
        var other = await _context.Users.FirstOrDefaultAsync(user => user.NormalizedUsername == normalized, cancellationToken);

        if (other == null) {
            return FriendOperation.Fail(FriendResult.UnknownUser);
        }

        if (other.Id == userId) {
            return FriendOperation.Fail(FriendResult.Self);
        }

        var existing = await Between(userId, other.Id).FirstOrDefaultAsync(cancellationToken);

        // Asking somebody who has already asked you is plainly a yes, so it settles the invitation rather than being refused.
        if (existing != null) {
            if (existing.Status == FriendshipStatus.Pending && existing.AddresseeId == userId) {
                existing.Status = FriendshipStatus.Accepted;
                existing.AcceptedUtc = DateTimeOffset.UtcNow;
                await _context.SaveChangesAsync(cancellationToken);
                return FriendOperation.Ok(other.Id);
            }

            return FriendOperation.Fail(FriendResult.AlreadyExists);
        }

        _context.Friendships.Add(new FriendshipRecord { RequesterId = userId, AddresseeId = other.Id });
        await _context.SaveChangesAsync(cancellationToken);

        return FriendOperation.Ok(other.Id);
    }


    public async Task<FriendOperation> AcceptAsync(Guid userId, Guid friendshipId, CancellationToken cancellationToken = default) {
        var row = await _context.Friendships.FirstOrDefaultAsync(candidate => candidate.Id == friendshipId, cancellationToken);

        // Only the side that was asked may accept, and only while the invitation is still outstanding.
        if (row == null || row.AddresseeId != userId || row.Status != FriendshipStatus.Pending) {
            return FriendOperation.Fail(FriendResult.NotFound);
        }

        row.Status = FriendshipStatus.Accepted;
        row.AcceptedUtc = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        return FriendOperation.Ok(row.RequesterId);
    }


    public async Task<FriendOperation> RemoveAsync(Guid userId, Guid friendshipId, CancellationToken cancellationToken = default) {
        var row = await _context.Friendships.FirstOrDefaultAsync(candidate => candidate.Id == friendshipId, cancellationToken);

        if (row == null || (row.RequesterId != userId && row.AddresseeId != userId)) {
            return FriendOperation.Fail(FriendResult.NotFound);
        }

        _context.Friendships.Remove(row);
        await _context.SaveChangesAsync(cancellationToken);

        return FriendOperation.Ok(row.RequesterId == userId ? row.AddresseeId : row.RequesterId);
    }


    private IQueryable<FriendshipRecord> Involving(Guid userId) {
        return _context.Friendships.Where(row => row.RequesterId == userId || row.AddresseeId == userId);
    }


    private IQueryable<FriendshipRecord> Between(Guid first, Guid second) {
        return _context.Friendships.Where(row => (row.RequesterId == first && row.AddresseeId == second) || (row.RequesterId == second && row.AddresseeId == first));
    }


    private static string Display(FriendSummary friend) {
        return friend.DisplayName ?? friend.Username;
    }


    private static int Rank(FriendPresence presence) {
        return presence switch { FriendPresence.Online => 0, FriendPresence.Busy => 1, _ => 2 };
    }
}
