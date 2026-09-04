using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Trumpfish.Server.Contracts;
using Trumpfish.Server.Services;

namespace Trumpfish.Server.Controllers;

/// <summary>
/// One deal at a time against three bots. The deal lives in the opaque state the client carries between requests, so the server
/// keeps nothing and a session survives a restart - while the three hands the player must not see stay out of reach.
/// </summary>
[ApiController]
[Authorize]
[Route("api/practice")]
[Produces("application/json")]
public class PracticeController : ControllerBase {

    private readonly IBiddingSystemStore _store;
    private readonly IPracticeService _practice;


    public PracticeController(IBiddingSystemStore store, IPracticeService practice) {
        _store = store;
        _practice = practice;
    }


    [HttpPost("deal")]
    [ProducesResponseType<PracticeState>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PracticeState>> Deal([FromBody] PracticeStartRequest request, CancellationToken cancellationToken) {
        if (request.SystemId == Guid.Empty) {
            return BadRequest("Wybierz system licytacyjny.");
        }

        var operation = await _store.GetAsync(request.SystemId, User.RequireUserId(), User.IsAdmin(), cancellationToken);
        if (operation.Result != SystemAccessResult.Success) {
            return NotFound("Nie znaleziono systemu licytacyjnego.");
        }

        return Answer(_practice.Start(operation.Value!, request));
    }


    [HttpPost("bid")]
    [ProducesResponseType<PracticeState>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PracticeState>> Bid([FromBody] PracticeBidRequest request, CancellationToken cancellationToken) {
        var data = _practice.Restore(request.State);
        if (data == null) {
            return BadRequest("Stan rozdania jest nieczytelny. Rozdaj ponownie.");
        }

        var operation = await _store.GetAsync(data.SystemId, User.RequireUserId(), User.IsAdmin(), cancellationToken);
        if (operation.Result != SystemAccessResult.Success) {
            return NotFound("Nie znaleziono systemu licytacyjnego.");
        }

        return Answer(_practice.Bid(operation.Value!, data, new PracticeStoredBid(request.Type, request.Color, request.Value)));
    }


    [HttpPost("hint")]
    [ProducesResponseType<PracticeHint>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PracticeHint>> Hint([FromBody] PracticeHintRequest request, CancellationToken cancellationToken) {
        var data = _practice.Restore(request.State);
        if (data == null) {
            return BadRequest("Stan rozdania jest nieczytelny. Rozdaj ponownie.");
        }

        var operation = await _store.GetAsync(data.SystemId, User.RequireUserId(), User.IsAdmin(), cancellationToken);
        if (operation.Result != SystemAccessResult.Success) {
            return NotFound("Nie znaleziono systemu licytacyjnego.");
        }

        var hint = _practice.Hint(operation.Value!, data);
        return hint == null ? BadRequest("To nie jest teraz twoja kolej.") : Ok(hint);
    }


    private ActionResult<PracticeState> Answer(PracticeResult result) {
        return result.State == null ? BadRequest(result.Problem ?? "Nie udało się rozegrać tej odzywki.") : Ok(result.State);
    }
}
