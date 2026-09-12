using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Model.Enums;
using Trumpfish.Server.Contracts;
using Trumpfish.Server.Services;
using Trumpfish.Server.Services.Dds;

namespace Trumpfish.Server.Controllers;

/// <summary>
/// Answers questions about a deal that is already on the table. Nothing here generates or stores anything: the client
/// sends the deal it is holding - out of a simulation, out of a finished practice deal - and gets the analysis back.
///
/// One deal per request, always on demand. The solver is the most expensive thing in the application by a wide margin,
/// and analysing deals nobody asked about would be paying that price for nothing.
/// </summary>
[ApiController]
[Authorize]
[Route("api/analysis")]
[Produces("application/json")]
public class AnalysisController : ControllerBase {

    private readonly IDoubleDummySolver _solver;


    public AnalysisController(IDoubleDummySolver solver) {
        _solver = solver;
    }


    /// <summary>
    /// Solves one deal double dummy and works out par for its dealer and vulnerability: the contract the deal is worth
    /// with neither side going wrong, and the pair that should be playing it.
    /// </summary>
    [HttpPost("dds")]
    [ProducesResponseType<DoubleDummyResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<DoubleDummyResponse>> DoubleDummy([FromBody] DoubleDummyRequest request, CancellationToken cancellationToken) {
        // A missing native library is a state of the deployment, not a bad request: the client should be able to hide the
        // button rather than show the player an error.
        if (!_solver.IsAvailable) {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, _solver.UnavailableReason);
        }

        var invalid = DoubleDummyMapping.Validate(request.Deal);
        if (invalid is not null) {
            return BadRequest(invalid);
        }

        try {
            var analysis = await _solver.AnalyseAsync(
                DoubleDummyMapping.ToHands(request.Deal),
                request.Deal.Dealer,
                request.Vulnerability ?? Vulnerability.None,
                cancellationToken);

            return Ok(DoubleDummyMapping.Map(analysis));
        }
        catch (DdsException exception) {
            // The solver rejected the deal itself - duplicated cards that survived the check above, or something equally
            // structural. Its own message is the most useful thing there is to say.
            return BadRequest(exception.Message);
        }
    }


    /// <summary>Whether the solver is there at all, and which library answered. The first thing to ask of a deployment.</summary>
    [HttpGet("dds/info")]
    [ProducesResponseType<DoubleDummyInfo>(StatusCodes.Status200OK)]
    public ActionResult<DoubleDummyInfo> Info() {
        return Ok(_solver.Describe());
    }
}
