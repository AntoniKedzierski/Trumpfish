using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Trumpfish.Server.Contracts;
using Trumpfish.Server.Services;

namespace Trumpfish.Server.Controllers;

/// <summary>
/// The deals a user has kept on his account. What is stored is the deal as it was on screen - the cards, the auction and
/// the contract - together with the name, keywords and remark he gave it. No analysis is kept: it is worked out on demand.
/// </summary>
[ApiController]
[Authorize]
[Route("api/deals")]
[Produces("application/json")]
public class SavedDealsController : ControllerBase {

    private readonly ISavedDealStore _store;
    private readonly IFriendService _friends;


    public SavedDealsController(ISavedDealStore store, IFriendService friends) {
        _store = store;
        _friends = friends;
    }


    [HttpPost]
    [ProducesResponseType<SavedDealSummary>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<SavedDealSummary>> Save([FromBody] SaveDealRequest request, CancellationToken cancellationToken) {
        if (string.IsNullOrWhiteSpace(request.Name)) {
            return BadRequest("Nazwij rozdanie, żeby dało się je później odnaleźć.");
        }

        if (request.Deal.Hands.Count != 4) {
            return BadRequest("Rozdanie jest niekompletne.");
        }

        return await _store.SaveAsync(User.RequireUserId(), request, cancellationToken);
    }


    /// <summary>
    /// Jedno rozdanie w całości: karty, licytacja i kontrakt. Widzi je właściciel i każdy, komu je udostępniono - widok
    /// analizy otwiera się tak samo z własnej listy, jak z cudzej.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType<SavedDeal>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SavedDeal>> Get(Guid id, CancellationToken cancellationToken) {
        var deal = await _store.GetAsync(User.RequireUserId(), id, cancellationToken);
        return deal == null ? NotFound("Nie znaleziono rozdania.") : deal;
    }


    /// <summary>
    /// One page of the caller's deals. <paramref name="contract"/> is the search as it is typed - "NT", "1S", "1d, H" -
    /// and <paramref name="tags"/> is a list of keywords every deal in the answer has to carry.
    /// </summary>
    [HttpGet]
    [ProducesResponseType<SavedDealPage>(StatusCodes.Status200OK)]
    public async Task<ActionResult<SavedDealPage>> List(
        [FromQuery] string? contract,
        [FromQuery] string? tags,
        [FromQuery] bool oldestFirst = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default) {
        return await _store.ListAsync(User.RequireUserId(), contract, tags, oldestFirst, page, pageSize, cancellationToken);
    }


    /// <summary>Changes the name, the keywords and the remark. The deal itself is a record of what happened and is never edited.</summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType<SavedDealSummary>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SavedDealSummary>> Update(Guid id, [FromBody] UpdateSavedDealRequest request, CancellationToken cancellationToken) {
        if (string.IsNullOrWhiteSpace(request.Name)) {
            return BadRequest("Nazwij rozdanie, żeby dało się je później odnaleźć.");
        }

        var updated = await _store.UpdateAsync(User.RequireUserId(), id, request, cancellationToken);
        return updated == null ? NotFound("Nie znaleziono zapisanego rozdania.") : updated;
    }


    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken) {
        return await _store.DeleteAsync(User.RequireUserId(), id, cancellationToken) ? NoContent() : NotFound();
    }


    /// <summary>One page of the deals other people have shared with the caller.</summary>
    [HttpGet("shared")]
    [ProducesResponseType<SharedDealPage>(StatusCodes.Status200OK)]
    public async Task<ActionResult<SharedDealPage>> Shared(
        [FromQuery] string? contract,
        [FromQuery] string? tags,
        [FromQuery] string? sharedBy,
        [FromQuery] bool oldestFirst = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default) {
        return await _store.ListSharedAsync(User.RequireUserId(), contract, tags, sharedBy, oldestFirst, page, pageSize, cancellationToken);
    }


    /// <summary>Stops receiving one shared deal. What the owner keeps is untouched - this is a row of permission, not a copy.</summary>
    [HttpDelete("shared/{shareId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RemoveShare(Guid shareId, CancellationToken cancellationToken) {
        return await _store.RemoveShareAsync(User.RequireUserId(), shareId, cancellationToken) ? NoContent() : NotFound();
    }


    /// <summary>Who this deal is shared with right now, so the dialog opens on what is already true.</summary>
    [HttpGet("{id:guid}/shares")]
    [ProducesResponseType<IReadOnlyList<Guid>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<Guid>>> Shares(Guid id, CancellationToken cancellationToken) {
        return Ok(await _store.ShareTargetsAsync(User.RequireUserId(), id, cancellationToken));
    }


    /// <summary>Shares the deal with exactly these friends. Anybody dropped from the set stops seeing it.</summary>
    [HttpPut("{id:guid}/shares")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Share(Guid id, [FromBody] ShareDealRequest request, CancellationToken cancellationToken) {
        var me = User.RequireUserId();
        var friends = await _friends.FriendIdsAsync(me, cancellationToken);

        return await _store.ShareAsync(me, id, request.UserIds, friends, cancellationToken) ? NoContent() : NotFound("Nie znaleziono zapisanego rozdania.");
    }


    /// <summary>The caller's own keywords, most used first. The tag field suggests from this list as it is typed into.</summary>
    [HttpGet("tags")]
    [ProducesResponseType<IReadOnlyList<SavedDealTag>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<SavedDealTag>>> Tags(CancellationToken cancellationToken) {
        return Ok(await _store.TagsAsync(User.RequireUserId(), cancellationToken));
    }
}
