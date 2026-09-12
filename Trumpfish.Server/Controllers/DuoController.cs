using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Trumpfish.Server.Contracts;
using Trumpfish.Server.Services;

namespace Trumpfish.Server.Controllers;

/// <summary>
/// The two-player table, as far as plain HTTP is concerned: what is waiting, and what is going on right now.
/// </summary>
/// <remarks>
/// Everything that changes a table happens over the hub - it is the connection whose closing ends a session, so nothing may
/// bypass it. These two reads exist for the moment a page loads, before any event has had a chance to arrive.
/// </remarks>
[ApiController]
[Authorize]
[Route("api/duo")]
[Produces("application/json")]
public class DuoController : ControllerBase {

    private readonly IDuoSessionService _sessions;
    private readonly ITableNotifier _notifier;


    public DuoController(IDuoSessionService sessions, ITableNotifier notifier) {
        _sessions = sessions;
        _notifier = notifier;
    }


    /// <summary>Invitations waiting for the caller, so a freshly loaded page shows the ones that arrived before it opened.</summary>
    [HttpGet("invitations")]
    [ProducesResponseType<IReadOnlyList<DuoInvitation>>(StatusCodes.Status200OK)]
    public ActionResult<IReadOnlyList<DuoInvitation>> Invitations() {
        return Ok(_sessions.InvitationsFor(User.RequireUserId()));
    }


    /// <summary>The table the caller is sitting at, or 204 when there is none.</summary>
    [HttpGet("table")]
    [ProducesResponseType<DuoTableState>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public ActionResult<DuoTableState> Table() {
        var userId = User.RequireUserId();
        var state = _sessions.SessionOf(userId)?.StateFor(userId);

        return state == null ? NoContent() : Ok(state);
    }


    /// <summary>
    /// Ends the session because the player is leaving the page for good - a reload, a closed tab, a step back in history.
    /// </summary>
    /// <remarks>
    /// A plain request rather than a hub call because it is sent from <c>pagehide</c> with <c>navigator.sendBeacon</c>, which
    /// is the only thing a browser reliably delivers while tearing a page down. It is also what tells a deliberate departure
    /// apart from a dropped connection: this ends the table at once, where a dropped connection is given time to come back.
    /// </remarks>
    [HttpPost("leave")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Leave() {
        var session = _sessions.SessionOf(User.RequireUserId());

        if (session != null) {
            await _notifier.EndAsync(session, DuoEndReason.PartnerLeft, "Partner opuścił stół. Sesja została zamknięta.", User.RequireUserId());
        }

        return NoContent();
    }
}
