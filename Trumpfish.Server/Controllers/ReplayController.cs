using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Trumpfish.Server.Contracts;
using Trumpfish.Server.Services;

namespace Trumpfish.Server.Controllers;

/// <summary>
/// Ponowne wylicytowanie gotowego rozdania: człowiek na wybranym miejscu, boty na trzech pozostałych. Rozdanie przychodzi
/// z żądaniem, a serwer nie zapisuje niczego - powtórka jest ćwiczeniem dla licytującego, a nie drugim zapisem rozdania.
/// </summary>
[ApiController]
[Authorize]
[Route("api/replay")]
[Produces("application/json")]
public class ReplayController : ControllerBase {

    private readonly IBiddingSystemStore _store;
    private readonly IReplayService _replay;


    public ReplayController(IBiddingSystemStore store, IReplayService replay) {
        _store = store;
        _replay = replay;
    }


    [HttpPost("start")]
    [ProducesResponseType<ReplayState>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ReplayState>> Start([FromBody] ReplayStartRequest request, CancellationToken cancellationToken) {
        if (request.SystemId == Guid.Empty) {
            return BadRequest("Wybierz system licytacyjny.");
        }

        var operation = await _store.GetAsync(request.SystemId, User.RequireUserId(), User.IsAdmin(), cancellationToken);
        if (operation.Result != SystemAccessResult.Success) {
            return NotFound("Nie znaleziono systemu licytacyjnego.");
        }

        return Answer(_replay.Start(operation.Value!, request));
    }


    [HttpPost("bid")]
    [ProducesResponseType<ReplayState>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ReplayState>> Bid([FromBody] ReplayBidRequest request, CancellationToken cancellationToken) {
        var data = _replay.Restore(request.State);
        if (data == null) {
            return BadRequest("Stan licytacji jest nieczytelny. Zacznij ją od nowa.");
        }

        var operation = await _store.GetAsync(data.SystemId, User.RequireUserId(), User.IsAdmin(), cancellationToken);
        if (operation.Result != SystemAccessResult.Success) {
            return NotFound("Nie znaleziono systemu licytacyjnego.");
        }

        return Answer(_replay.Bid(operation.Value!, data, new PracticeStoredBid(request.Type, request.Color, request.Value)));
    }


    private ActionResult<ReplayState> Answer(ReplayResult result) {
        return result.State == null ? BadRequest(result.Problem ?? "Nie udało się rozegrać tej odzywki.") : Ok(result.State);
    }
}
