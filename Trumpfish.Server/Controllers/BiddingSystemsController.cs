using Microsoft.AspNetCore.Mvc;
using Model.Bidding.AI;
using Model.Bidding.Validation;
using Trumpfish.Server.Contracts;
using Trumpfish.Server.Services;

namespace Trumpfish.Server.Controllers;

/// <summary>
/// CRUD over bidding systems authored in the web Bidding Browser. The request/response types come straight from the shared <c>Model</c> project,
/// so the OpenAPI document is the single source of truth for the TypeScript models.
/// </summary>
[ApiController]
[Route("api/bidding-systems")]
[Produces("application/json")]
public class BiddingSystemsController : ControllerBase {

    private readonly IBiddingSystemStore _store;


    public BiddingSystemsController(IBiddingSystemStore store) {
        _store = store;
    }


    [HttpGet]
    [ProducesResponseType<IReadOnlyList<BiddingSystemSummary>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<BiddingSystemSummary>>> List(CancellationToken cancellationToken) {
        return Ok(await _store.ListAsync(cancellationToken));
    }


    [HttpGet("{name}")]
    [ProducesResponseType<BiddingSystem>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<BiddingSystem>> Get(string name, CancellationToken cancellationToken) {
        var system = await _store.GetAsync(name, cancellationToken);
        if (system == null) {
            return NotFound();
        }

        return Ok(system);
    }


    [HttpPut("{name}")]
    [ProducesResponseType<BiddingSystemSummary>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<BiddingSystemSummary>> Save(string name, [FromBody] BiddingSystem system, CancellationToken cancellationToken) {
        if (string.IsNullOrWhiteSpace(name)) {
            return BadRequest("System name is required.");
        }

        return Ok(await _store.SaveAsync(name, system, cancellationToken));
    }


    [HttpDelete("{name}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(string name, CancellationToken cancellationToken) {
        return await _store.DeleteAsync(name, cancellationToken) ? NoContent() : NotFound();
    }


    [HttpPost("validate")]
    [ProducesResponseType<IReadOnlyList<ValidationIssue>>(StatusCodes.Status200OK)]
    public ActionResult<IReadOnlyList<ValidationIssue>> Validate([FromBody] BiddingSystem system) {
        return Ok(new TreeValidator().Validate(system));
    }
}
