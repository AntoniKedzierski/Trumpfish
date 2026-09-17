using Microsoft.EntityFrameworkCore;
using Model.Enums;
using System.Linq.Expressions;
using System.Text.Json;
using Trumpfish.Server.Contracts;
using Trumpfish.Server.Data;

namespace Trumpfish.Server.Services;

public sealed class SavedDealStore : ISavedDealStore {

    /// <summary>The deal travels as the client wrote it; camel case keeps the stored JSON identical to what crosses the wire.</summary>
    internal static readonly JsonSerializerOptions DealJson = new(JsonSerializerDefaults.Web);

    private readonly TrumpfishDbContext _db;
    private readonly ISavedDealArchive _archive;


    public SavedDealStore(TrumpfishDbContext db, ISavedDealArchive archive) {
        _db = db;
        _archive = archive;
    }


    public async Task<SavedDealSummary> SaveAsync(Guid ownerId, SaveDealRequest request, CancellationToken cancellationToken = default) {
        var record = new SavedDealRecord {
            OwnerId = ownerId,
            Name = Clip(request.Name, 200),
            Tags = string.Join(' ', ParseTags(request.Tags)),
            Comment = string.IsNullOrWhiteSpace(request.Comment) ? null : Clip(request.Comment.Trim(), 2000),
            Contract = Clip(ContractLabel(request.Deal.Contract), 32),
            Level = request.Deal.Contract.Passed ? null : request.Deal.Contract.Value,
            Color = request.Deal.Contract.Passed ? null : request.Deal.Contract.Color,
            Declarer = request.Deal.Contract.Passed ? null : request.Deal.Contract.Declarer,
            Dealer = request.Deal.Dealer,
            Vulnerability = request.Vulnerability,
            Deal = JsonSerializer.Serialize(request.Deal, DealJson),
        };

        _db.SavedDeals.Add(record);
        await _db.SaveChangesAsync(cancellationToken);

        // Only ever does anything on a developer's machine: the in-memory database is gone at the next start, and a deal
        // kept while working on the feature that saves it is exactly the one worth having back.
        await _archive.KeepAsync(record, cancellationToken);

        return Describe(record);
    }


    /// <summary>Jedno rozdanie w całości. Udostępnienie daje dokładnie to samo prawo do obejrzenia go, co własność.</summary>
    public async Task<SavedDeal?> GetAsync(Guid userId, Guid id, CancellationToken cancellationToken = default) {
        var record = await _db.SavedDeals
            .FirstOrDefaultAsync(
                deal => deal.Id == id && (deal.OwnerId == userId || _db.SavedDealShares.Any(share => share.DealId == deal.Id && share.ToUserId == userId)),
                cancellationToken);

        if (record == null) {
            return null;
        }

        // Rozdanie wraca w tej samej postaci, w jakiej przyszło: kolumna trzyma dokładnie to, co klient wtedy wysłał.
        var deal = JsonSerializer.Deserialize<SimulationDealResult>(record.Deal, DealJson);

        return deal == null ? null : new SavedDeal(Describe(record), deal);
    }


    public async Task<SavedDealPage> ListAsync(Guid ownerId, string? contract, string? tags, bool oldestFirst, int page, int pageSize, CancellationToken cancellationToken = default) {
        var size = Math.Clamp(pageSize, 5, 200);
        var wanted = Math.Max(page, 1);

        var query = Narrow(_db.SavedDeals.Where(deal => deal.OwnerId == ownerId), contract, tags);

        var total = await query.CountAsync(cancellationToken);

        // A page past the end is what deleting the last row of the last page leaves behind, so it is walked back rather
        // than answered with nothing.
        var pages = Math.Max(1, (int)Math.Ceiling(total / (double)size));
        var current = Math.Min(wanted, pages);

        // Ordered, paged and counted by the database. The id breaks a tie, so two deals kept in the same second cannot
        // swap places between one page and the next and leave a row unreachable.
        var ordered = oldestFirst
            ? query.OrderBy(deal => deal.SavedUtc).ThenBy(deal => deal.Id)
            : query.OrderByDescending(deal => deal.SavedUtc).ThenByDescending(deal => deal.Id);

        var rows = await ordered.Skip((current - 1) * size).Take(size).ToListAsync(cancellationToken);

        return new SavedDealPage(rows.Select(Describe).ToList(), total, current, size);
    }


    public async Task<SavedDealSummary?> UpdateAsync(Guid ownerId, Guid id, UpdateSavedDealRequest request, CancellationToken cancellationToken = default) {
        var record = await _db.SavedDeals.FirstOrDefaultAsync(deal => deal.Id == id && deal.OwnerId == ownerId, cancellationToken);
        if (record == null) {
            return null;
        }

        record.Name = Clip(request.Name, 200);
        record.Tags = string.Join(' ', ParseTags(request.Tags));
        record.Comment = string.IsNullOrWhiteSpace(request.Comment) ? null : Clip(request.Comment.Trim(), 2000);

        await _db.SaveChangesAsync(cancellationToken);
        await _archive.KeepAsync(record, cancellationToken);

        return Describe(record);
    }


    public async Task<bool> DeleteAsync(Guid ownerId, Guid id, CancellationToken cancellationToken = default) {
        var removed = await _db.SavedDeals.Where(deal => deal.Id == id && deal.OwnerId == ownerId).ExecuteDeleteAsync(cancellationToken);
        if (removed > 0) {
            await _archive.ForgetAsync(id, cancellationToken);
        }

        return removed > 0;
    }


    public async Task<IReadOnlyList<Guid>> ShareTargetsAsync(Guid ownerId, Guid dealId, CancellationToken cancellationToken = default) {
        return await _db.SavedDealShares
            .Where(share => share.DealId == dealId && share.Deal!.OwnerId == ownerId)
            .Select(share => share.ToUserId)
            .ToListAsync(cancellationToken);
    }


    public async Task<bool> ShareAsync(Guid ownerId, Guid dealId, IReadOnlyList<Guid> userIds, IReadOnlyList<Guid> friendIds, CancellationToken cancellationToken = default) {
        var owned = await _db.SavedDeals.AnyAsync(deal => deal.Id == dealId && deal.OwnerId == ownerId, cancellationToken);
        if (!owned) {
            return false;
        }

        var wanted = userIds.Distinct().Where(friendIds.Contains).ToHashSet();
        var existing = await _db.SavedDealShares.Where(share => share.DealId == dealId).ToListAsync(cancellationToken);

        _db.SavedDealShares.RemoveRange(existing.Where(share => !wanted.Contains(share.ToUserId)));
        _db.SavedDealShares.AddRange(wanted
            .Where(userId => existing.All(share => share.ToUserId != userId))
            .Select(userId => new SavedDealShareRecord { DealId = dealId, ToUserId = userId }));

        await _db.SaveChangesAsync(cancellationToken);
        return true;
    }


    public async Task<SharedDealPage> ListSharedAsync(Guid userId, string? contract, string? tags, string? sharedBy, bool oldestFirst, int page, int pageSize, CancellationToken cancellationToken = default) {
        var size = Math.Clamp(pageSize, 5, 200);
        var wanted = Math.Max(page, 1);

        /*
         * The filters are the same questions as on a user's own list, so they are asked of the deals themselves and the
         * shares are then narrowed to what came back. One filter, one meaning, wherever it is typed.
         */
        var deals = Narrow(_db.SavedDeals.AsQueryable(), contract, tags);

        if (!string.IsNullOrWhiteSpace(sharedBy)) {
            var who = sharedBy.Trim();
            deals = deals.Where(deal => deal.Owner!.Username.Contains(who) || (deal.Owner.DisplayName != null && deal.Owner.DisplayName.Contains(who)));
        }

        var query = _db.SavedDealShares
            .Where(share => share.ToUserId == userId && deals.Any(deal => deal.Id == share.DealId));

        var total = await query.CountAsync(cancellationToken);
        var pages = Math.Max(1, (int)Math.Ceiling(total / (double)size));
        var current = Math.Min(wanted, pages);

        var ordered = oldestFirst
            ? query.OrderBy(share => share.SharedUtc).ThenBy(share => share.Id)
            : query.OrderByDescending(share => share.SharedUtc).ThenByDescending(share => share.Id);

        var rows = await ordered
            .Include(share => share.Deal!).ThenInclude(deal => deal.Owner)
            .Skip((current - 1) * size)
            .Take(size)
            .ToListAsync(cancellationToken);

        var shared = rows
            .Select(share => new SharedDealSummary(
                share.Id,
                Describe(share.Deal!),
                share.Deal!.Owner?.DisplayName ?? share.Deal.Owner?.Username ?? "?",
                share.SharedUtc))
            .ToList();

        return new SharedDealPage(shared, total, current, size);
    }


    public async Task<bool> RemoveShareAsync(Guid userId, Guid shareId, CancellationToken cancellationToken = default) {
        return await _db.SavedDealShares.Where(share => share.Id == shareId && share.ToUserId == userId).ExecuteDeleteAsync(cancellationToken) > 0;
    }


    public async Task<IReadOnlyList<SavedDealTag>> TagsAsync(Guid ownerId, CancellationToken cancellationToken = default) {
        var rows = await _db.SavedDeals
            .Where(deal => deal.OwnerId == ownerId && deal.Tags != string.Empty)
            .Select(deal => deal.Tags)
            .ToListAsync(cancellationToken);

        // Counted here rather than in SQL: the column holds a sentence of keywords, and splitting one is not something a
        // query can do on both providers. A user's own deals are few enough that this is a handful of strings.
        return rows
            .SelectMany(tags => tags.Split(' ', StringSplitOptions.RemoveEmptyEntries))
            .GroupBy(tag => tag, StringComparer.OrdinalIgnoreCase)
            .Select(group => new SavedDealTag(group.First(), group.Count()))
            .OrderByDescending(tag => tag.Count)
            .ThenBy(tag => tag.Tag, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }


    /// <summary>What the two filters mean, in one place: a user's own list and the list shared with him ask the same question.</summary>
    private static IQueryable<SavedDealRecord> Narrow(IQueryable<SavedDealRecord> deals, string? contract, string? tags) {
        var predicate = ContractPredicate(ContractFilter.Parse(contract));
        if (predicate != null) {
            deals = deals.Where(predicate);
        }

        // Every keyword has to be there, not any of them: filtering is narrowing, and a second tag that widened the list
        // would be a filter that undoes the first one.
        foreach (var tag in ParseTags(tags)) {
            var padded = $" {tag} ";
            deals = deals.Where(deal => (" " + deal.Tags + " ").Contains(padded));
        }

        return deals;
    }


    /// <summary>
    /// \"every contract in hearts, and every one diamond\" as one expression over the two columns the contract is kept in.
    /// </summary>
    /// <remarks>
    /// Built by hand because the terms are a list the user typed: a fixed `Where` can ask one such question, and this has
    /// to ask however many were typed, joined by or.
    /// </remarks>
    private static Expression<Func<SavedDealRecord, bool>>? ContractPredicate(IReadOnlyList<ContractFilter.Term> terms) {
        if (terms.Count == 0) {
            return null;
        }

        var deal = Expression.Parameter(typeof(SavedDealRecord), "deal");
        Expression? any = null;

        foreach (var term in terms) {
            Expression? clause = null;

            if (term.Level != null) {
                clause = Expression.Equal(Expression.Property(deal, nameof(SavedDealRecord.Level)), Expression.Constant(term.Level, typeof(int?)));
            }

            if (term.Color != null) {
                var color = Expression.Equal(Expression.Property(deal, nameof(SavedDealRecord.Color)), Expression.Constant(term.Color, typeof(BidColor?)));
                clause = clause == null ? color : Expression.AndAlso(clause, color);
            }

            if (clause != null) {
                any = any == null ? clause : Expression.OrElse(any, clause);
            }
        }

        return any == null ? null : Expression.Lambda<Func<SavedDealRecord, bool>>(any, deal);
    }


    /// <summary>One row of the list, as the client reads it: the keywords come back as a list rather than as the sentence they are stored in.</summary>
    internal static SavedDealSummary Describe(SavedDealRecord record) {
        return new SavedDealSummary(
            record.Id,
            record.Name,
            record.Contract,
            record.Level,
            record.Color,
            record.Declarer,
            record.Tags.Split(' ', StringSplitOptions.RemoveEmptyEntries),
            record.Comment,
            record.Dealer,
            record.Vulnerability,
            record.SavedUtc);
    }


    /// <summary>
    /// Keywords as they are kept: single words, lower case, no duplicates. Whatever separators the user typed - spaces,
    /// commas, semicolons - come to the same thing, because a tag with a comma in it is a tag nothing will ever match.
    /// </summary>
    internal static IReadOnlyList<string> ParseTags(string? tags) {
        if (string.IsNullOrWhiteSpace(tags)) {
            return [];
        }

        return tags
            .Split([' ', ',', ';', '\t', '\n', '\r'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(tag => Clip(tag.ToLowerInvariant(), 40))
            .Distinct(StringComparer.Ordinal)
            .Take(20)
            .ToList();
    }


    /// <summary>The contract as it is written on the card: the level and denomination, the doubles, then the seat playing it.</summary>
    private static string ContractLabel(SimulationContract contract) {
        if (contract.Passed) {
            return contract.Label;
        }

        var doubles = contract.IsRedoubled ? "xx" : contract.IsDoubled ? "x" : string.Empty;
        return $"{contract.Label}{doubles}{(contract.Declarer == null ? string.Empty : $" {contract.Declarer}")}".Trim();
    }


    private static string Clip(string value, int length) {
        var trimmed = value.Trim();
        return trimmed.Length <= length ? trimmed : trimmed[..length];
    }
}
