using System.Text.Json.Serialization;

namespace Trumpfish.Server.Contracts;

/// <summary>
/// Where one account stands towards another, told from the point of view of whoever asked. The same database row reads as an
/// incoming invitation to one side and an outgoing one to the other, which is why this is not the stored status.
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter<FriendshipState>))]
public enum FriendshipState {
    Friend,

    /// <summary>Somebody asked to be the caller friend and is waiting to be let in.</summary>
    Incoming,

    /// <summary>The caller asked and is waiting to be let in.</summary>
    Outgoing
}

/// <summary>Whether a friend can be invited to a table right now.</summary>
[JsonConverter(typeof(JsonStringEnumConverter<FriendPresence>))]
public enum FriendPresence {
    Offline,

    Online,

    /// <summary>Signed in, but already at a table - so an invitation would only be refused.</summary>
    Busy
}

/// <summary>One entry of the friends dropdown: the other account, and what the caller may do about it.</summary>
public record FriendSummary(Guid FriendshipId, Guid UserId, string Username, string? DisplayName, FriendshipState State, FriendPresence Presence);

/// <summary>The whole dropdown in one answer: accepted friends first, then what is waiting on either side.</summary>
public record FriendsView(IReadOnlyList<FriendSummary> Friends, IReadOnlyList<FriendSummary> Incoming, IReadOnlyList<FriendSummary> Outgoing);

/// <summary>Asks to befriend an account by the name it signed up with.</summary>
public record InviteFriendRequest(string Username);
