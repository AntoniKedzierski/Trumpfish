using Trumpfish.Server.Contracts;

namespace Trumpfish.Server.Services;

/// <summary>Reads and writes the deals an account has kept.</summary>
public interface ISavedDealStore {

    /// <summary>Keeps one deal for this account and answers with the row the list will show.</summary>
    Task<SavedDealSummary> SaveAsync(Guid ownerId, SaveDealRequest request, CancellationToken cancellationToken = default);

    /// <summary>One page of this account's deals, newest first unless asked otherwise.</summary>
    Task<SavedDealPage> ListAsync(Guid ownerId, string? contract, string? tags, bool oldestFirst, int page, int pageSize, CancellationToken cancellationToken = default);

    /// <summary>Changes the name, the keywords and the remark. False when the deal is not this account's.</summary>
    Task<SavedDealSummary?> UpdateAsync(Guid ownerId, Guid id, UpdateSavedDealRequest request, CancellationToken cancellationToken = default);

    /// <summary>Removes one deal for good. False when there was nothing of this account's to remove.</summary>
    Task<bool> DeleteAsync(Guid ownerId, Guid id, CancellationToken cancellationToken = default);

    /// <summary>The accounts one of this owner's deals is currently shared with.</summary>
    Task<IReadOnlyList<Guid>> ShareTargetsAsync(Guid ownerId, Guid dealId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Makes the deal shared with exactly these accounts and no others. Anybody dropped from the set loses it; anybody
    /// who is not a friend is ignored rather than refused, because friendship can end between opening the dialog and using it.
    /// </summary>
    Task<bool> ShareAsync(Guid ownerId, Guid dealId, IReadOnlyList<Guid> userIds, IReadOnlyList<Guid> friendIds, CancellationToken cancellationToken = default);

    /// <summary>One page of the deals other people have shared with this account.</summary>
    Task<SharedDealPage> ListSharedAsync(Guid userId, string? contract, string? tags, string? sharedBy, bool oldestFirst, int page, int pageSize, CancellationToken cancellationToken = default);

    /// <summary>Stops receiving one shared deal. The deal itself belongs to somebody else and is untouched.</summary>
    Task<bool> RemoveShareAsync(Guid userId, Guid shareId, CancellationToken cancellationToken = default);

    /// <summary>Every keyword this account has ever used, most used first. The field on the save dialog suggests from this.</summary>
    Task<IReadOnlyList<SavedDealTag>> TagsAsync(Guid ownerId, CancellationToken cancellationToken = default);
}
