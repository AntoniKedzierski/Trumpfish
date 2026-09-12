using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Trumpfish.Server.Contracts;
using Trumpfish.Server.Services;

namespace Trumpfish.Server.Controllers;

/// <summary>
/// The friends list behind the dropdown in the top bar. Reads and writes go over plain HTTP; the live half of it - who is
/// online, and who has just invited you to a table - arrives over the hub instead.
/// </summary>
[ApiController]
[Authorize]
[Route("api/friends")]
[Produces("application/json")]
public class FriendsController : ControllerBase {

    private readonly IFriendService _friends;
    private readonly ITableNotifier _notifier;


    public FriendsController(IFriendService friends, ITableNotifier notifier) {
        _friends = friends;
        _notifier = notifier;
    }


    [HttpGet]
    [ProducesResponseType<FriendsView>(StatusCodes.Status200OK)]
    public async Task<ActionResult<FriendsView>> List(CancellationToken cancellationToken) {
        return Ok(await _friends.ViewAsync(User.RequireUserId(), cancellationToken));
    }


    [HttpPost("invite")]
    [ProducesResponseType<FriendsView>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<FriendsView>> Invite([FromBody] InviteFriendRequest request, CancellationToken cancellationToken) {
        if (string.IsNullOrWhiteSpace(request.Username)) {
            return BadRequest("Podaj nazwę użytkownika.");
        }

        return await Apply(await _friends.InviteAsync(User.RequireUserId(), request.Username, cancellationToken), cancellationToken);
    }


    [HttpPost("{friendshipId:guid}/accept")]
    [ProducesResponseType<FriendsView>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<FriendsView>> Accept(Guid friendshipId, CancellationToken cancellationToken) {
        return await Apply(await _friends.AcceptAsync(User.RequireUserId(), friendshipId, cancellationToken), cancellationToken);
    }


    /// <summary>Removes a friendship, declines an invitation or withdraws one - all three are the same row going away.</summary>
    [HttpDelete("{friendshipId:guid}")]
    [ProducesResponseType<FriendsView>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<FriendsView>> Remove(Guid friendshipId, CancellationToken cancellationToken) {
        return await Apply(await _friends.RemoveAsync(User.RequireUserId(), friendshipId, cancellationToken), cancellationToken);
    }


    /// <summary>Answers with the caller own list, and pushes the other account a nudge to fetch its changed one.</summary>
    private async Task<ActionResult<FriendsView>> Apply(FriendOperation operation, CancellationToken cancellationToken) {
        switch (operation.Result) {
            case FriendResult.UnknownUser:
                return NotFound("Nie ma użytkownika o takiej nazwie.");

            case FriendResult.Self:
                return BadRequest("Nie możesz zaprosić samego siebie.");

            case FriendResult.AlreadyExists:
                return Conflict("Jesteście już znajomymi albo zaproszenie już czeka.");

            case FriendResult.NotFound:
                return NotFound("Nie znaleziono tego zaproszenia.");
        }

        if (operation.OtherUserId != null) {
            await _notifier.FriendsChangedAsync([operation.OtherUserId.Value]);
        }

        return Ok(await _friends.ViewAsync(User.RequireUserId(), cancellationToken));
    }
}
