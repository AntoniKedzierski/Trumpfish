using Microsoft.AspNetCore.Authorization;
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
/// <remarks>
/// Systems are addressed by id rather than by name, because names are no longer stable identifiers: the manage page renames
/// them, and a fork legitimately carries the same name as the seed it came from.
/// </remarks>
[ApiController]
[Authorize]
[Route("api/bidding-systems")]
[Produces("application/json")]
public class BiddingSystemsController : ControllerBase {

    private readonly IBiddingSystemStore _store;


    public BiddingSystemsController(IBiddingSystemStore store) {
        _store = store;
    }


    /// <summary>The systems the caller works on: the seeds for an administrator, their own systems for anyone else.</summary>
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<BiddingSystemSummary>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<BiddingSystemSummary>>> List(CancellationToken cancellationToken) {
        return Ok(await _store.ListAsync(User.RequireUserId(), User.IsAdmin(), cancellationToken));
    }


    /// <summary>The seed catalogue. Readable by everyone so a plain account can pick one to fork.</summary>
    [HttpGet("seeds")]
    [ProducesResponseType<IReadOnlyList<BiddingSystemSummary>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<BiddingSystemSummary>>> ListSeeds(CancellationToken cancellationToken) {
        return Ok(await _store.ListSeedsAsync(cancellationToken));
    }


    [HttpGet("{id:guid}")]
    [ProducesResponseType<BiddingSystem>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<BiddingSystem>> Get(Guid id, CancellationToken cancellationToken) {
        var operation = await _store.GetAsync(id, User.RequireUserId(), User.IsAdmin(), cancellationToken);
        return operation.Result == SystemAccessResult.Success ? Ok(operation.Value) : Problem(operation.Result);
    }


    [HttpPost]
    [ProducesResponseType<BiddingSystemSummary>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<BiddingSystemSummary>> Create([FromBody] SaveSystemRequest request, CancellationToken cancellationToken) {
        if (string.IsNullOrWhiteSpace(request.Name)) {
            return BadRequest("System name is required.");
        }

        var operation = await _store.CreateAsync(request.Name.Trim(), request.System, User.RequireUserId(), User.IsAdmin(), cancellationToken);
        if (operation.Result != SystemAccessResult.Success) {
            return Problem(operation.Result);
        }

        return CreatedAtAction(nameof(Get), new { id = operation.Value!.Id }, operation.Value);
    }


    [HttpPut("{id:guid}")]
    [ProducesResponseType<BiddingSystemSummary>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<BiddingSystemSummary>> Save(Guid id, [FromBody] BiddingSystem system, CancellationToken cancellationToken) {
        var operation = await _store.SaveAsync(id, system, User.RequireUserId(), User.IsAdmin(), cancellationToken);
        return operation.Result == SystemAccessResult.Success ? Ok(operation.Value) : Problem(operation.Result);
    }


    [HttpPut("{id:guid}/name")]
    [ProducesResponseType<BiddingSystemSummary>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<BiddingSystemSummary>> Rename(Guid id, [FromBody] RenameSystemRequest request, CancellationToken cancellationToken) {
        if (string.IsNullOrWhiteSpace(request.Name)) {
            return BadRequest("System name is required.");
        }

        var operation = await _store.RenameAsync(id, request.Name.Trim(), User.RequireUserId(), User.IsAdmin(), cancellationToken);
        return operation.Result == SystemAccessResult.Success ? Ok(operation.Value) : Problem(operation.Result);
    }


    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken) {
        var result = await _store.DeleteAsync(id, User.RequireUserId(), User.IsAdmin(), cancellationToken);
        return result == SystemAccessResult.Success ? NoContent() : Problem(result);
    }


    /// <summary>Takes a private copy of a seed. The copy remembers which seed it came from, so later seed edits can be offered.</summary>
    [HttpPost("{id:guid}/fork")]
    [ProducesResponseType<BiddingSystemSummary>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<BiddingSystemSummary>> Fork(Guid id, CancellationToken cancellationToken) {
        var operation = await _store.ForkAsync(id, User.RequireUserId(), User.IsAdmin(), cancellationToken);
        if (operation.Result != SystemAccessResult.Success) {
            return Problem(operation.Result);
        }

        return CreatedAtAction(nameof(Get), new { id = operation.Value!.Id }, operation.Value);
    }


    /// <summary>Replaces a fork's tree with the seed's current one, discarding whatever the owner changed in their copy.</summary>
    [HttpPost("{id:guid}/refork")]
    [ProducesResponseType<BiddingSystemSummary>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<BiddingSystemSummary>> Refork(Guid id, CancellationToken cancellationToken) {
        var operation = await _store.ReforkAsync(id, User.RequireUserId(), User.IsAdmin(), cancellationToken);
        return operation.Result == SystemAccessResult.Success ? Ok(operation.Value) : Problem(operation.Result);
    }


    [HttpPost("validate")]
    [ProducesResponseType<IReadOnlyList<ValidationIssue>>(StatusCodes.Status200OK)]
    public ActionResult<IReadOnlyList<ValidationIssue>> Validate([FromBody] BiddingSystem system) {
        return Ok(new TreeValidator().Validate(system));
    }


    /// <summary>
    /// Writes every seed into the server's own <c>Seed</c> folder so a developer can commit them, and deletes the files that no
    /// longer match a seed. This is how work done against the in-memory development database reaches the repository, and from
    /// there both the team and production. Only an administrator on a Debug build can reach it.
    /// </summary>
    [HttpPost("export-seeds")]
    [Authorize(Roles = Roles.Admin)]
    [ProducesResponseType<SeedExportResult>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SeedExportResult>> ExportSeeds([FromServices] ISeedExporter exporter, CancellationToken cancellationToken) {
        if (!exporter.IsAvailable) {
            return NotFound("Eksport seedów jest dostępny tylko w konfiguracji Debug.");
        }

        return Ok(await exporter.ExportAllAsync(cancellationToken));
    }


    private ObjectResult Problem(SystemAccessResult result) => result switch {
        SystemAccessResult.NotFound => Problem("Nie znaleziono systemu.", statusCode: StatusCodes.Status404NotFound),
        SystemAccessResult.Forbidden => Problem("Nie masz uprawnień do tego systemu.", statusCode: StatusCodes.Status403Forbidden),
        SystemAccessResult.NameTaken => Problem("System o tej nazwie już istnieje.", statusCode: StatusCodes.Status409Conflict),
        SystemAccessResult.NotAFork => Problem("Ten system nie pochodzi z seeda.", statusCode: StatusCodes.Status409Conflict),
        _ => Problem("Nieoczekiwany błąd.", statusCode: StatusCodes.Status500InternalServerError)
    };
}
