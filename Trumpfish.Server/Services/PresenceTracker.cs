using System.Collections.Concurrent;
using Trumpfish.Server.Contracts;

namespace Trumpfish.Server.Services;

/// <summary>Who is signed in right now, and whether they are free to be invited to a table.</summary>
public interface IPresenceTracker {

    /// <summary>Records a new connection. Returns true when this was the first one the account had, so it has just come online.</summary>
    bool Connect(Guid userId, string connectionId);

    /// <summary>Drops a connection. Returns true when it was the last one the account had, so it has just gone offline.</summary>
    bool Disconnect(Guid userId, string connectionId);

    FriendPresence PresenceOf(Guid userId);

    /// <summary>Marks an account as sitting at a table, so friends see it as busy rather than merely online.</summary>
    void SetBusy(Guid userId, bool busy);

    /// <summary>Every live connection of one account, which is how a message reaches somebody with two tabs open.</summary>
    IReadOnlyCollection<string> ConnectionsOf(Guid userId);
}

/// <summary>
/// A plain in-memory register of live hub connections, one entry per account.
/// </summary>
/// <remarks>
/// Accounts are tracked rather than connections because the same person may well have two tabs open, and both of them should
/// count as one presence. Nothing here survives a restart, which is correct: after a restart nobody is connected anyway.
/// </remarks>
public class PresenceTracker : IPresenceTracker {

    private readonly ConcurrentDictionary<Guid, HashSet<string>> _connections = new();
    private readonly ConcurrentDictionary<Guid, byte> _busy = new();


    public bool Connect(Guid userId, string connectionId) {
        var connections = _connections.GetOrAdd(userId, _ => []);

        lock (connections) {
            connections.Add(connectionId);
            return connections.Count == 1;
        }
    }


    public bool Disconnect(Guid userId, string connectionId) {
        if (!_connections.TryGetValue(userId, out var connections)) {
            return false;
        }

        lock (connections) {
            connections.Remove(connectionId);

            if (connections.Count > 0) {
                return false;
            }
        }

        _connections.TryRemove(userId, out _);
        _busy.TryRemove(userId, out _);
        return true;
    }


    public FriendPresence PresenceOf(Guid userId) {
        if (!_connections.TryGetValue(userId, out var connections)) {
            return FriendPresence.Offline;
        }

        lock (connections) {
            if (connections.Count == 0) {
                return FriendPresence.Offline;
            }
        }

        return _busy.ContainsKey(userId) ? FriendPresence.Busy : FriendPresence.Online;
    }


    public void SetBusy(Guid userId, bool busy) {
        if (busy) {
            _busy[userId] = 0;
        }
        else {
            _busy.TryRemove(userId, out _);
        }
    }


    public IReadOnlyCollection<string> ConnectionsOf(Guid userId) {
        if (!_connections.TryGetValue(userId, out var connections)) {
            return [];
        }

        lock (connections) {
            return [.. connections];
        }
    }
}
