using Model.Enums;

namespace Trumpfish.Server.Contracts;

/// <summary>
/// A deal being kept. <paramref name="Deal"/> is the very shape the simulator and the practice table already hand to the
/// client, so what is stored is what was on screen; <paramref name="Vulnerability"/> comes with it because a deal result
/// carries only its board number, and a saved deal should not depend on the rotation being recomputed the same way later.
/// </summary>
public record SaveDealRequest(string Name, string? Tags, string? Comment, Vulnerability Vulnerability, SimulationDealResult Deal);

/// <summary>One row of the saved deals list: everything it is read, sorted and searched by, without the deal itself.</summary>
public record SavedDealSummary(
    Guid Id,
    string Name,
    string Contract,
    int? Level,
    BidColor? Color,
    PlayerPosition? Declarer,
    IReadOnlyList<string> Tags,
    string? Comment,
    PlayerPosition Dealer,
    Vulnerability Vulnerability,
    DateTimeOffset SavedUtc);

/// <summary>What the pencil may change. The deal itself is never edited - it is a record of what happened.</summary>
public record UpdateSavedDealRequest(string Name, string? Tags, string? Comment);

/// <summary>One page of the list, plus how many rows there are altogether so the pager knows where it is.</summary>
public record SavedDealPage(IReadOnlyList<SavedDealSummary> Deals, int Total, int Page, int PageSize);

/// <summary>One of the user's own keywords, with how often he has used it. Ordered by that count, which is what the field suggests by.</summary>
public record SavedDealTag(string Tag, int Count);

/// <summary>Who a deal is shared with, as a whole set: the dialog hands back everybody it should be shared with now.</summary>
public record ShareDealRequest(IReadOnlyList<Guid> UserIds);

/// <summary>One deal somebody else kept and handed on, with the row that is dropped to stop receiving it.</summary>
public record SharedDealSummary(Guid ShareId, SavedDealSummary Deal, string SharedBy, DateTimeOffset SharedUtc);

/// <summary>One page of the deals shared with the caller.</summary>
public record SharedDealPage(IReadOnlyList<SharedDealSummary> Deals, int Total, int Page, int PageSize);
