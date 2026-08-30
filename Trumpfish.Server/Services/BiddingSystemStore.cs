using Microsoft.EntityFrameworkCore;
using Model.Bidding.AI;
using Trumpfish.Server.Contracts;
using Trumpfish.Server.Data;

namespace Trumpfish.Server.Services;

public class BiddingSystemStore : IBiddingSystemStore {

    private readonly TrumpfishDbContext _db;


    public BiddingSystemStore(TrumpfishDbContext db) {
        _db = db;
    }


    public async Task<IReadOnlyList<BiddingSystemSummary>> ListAsync(Guid userId, bool isAdmin, CancellationToken cancellationToken = default) {
        var query = isAdmin ? _db.BiddingSystems.Where(system => system.IsSeed) : _db.BiddingSystems.Where(system => system.OwnerId == userId);
        return await Summaries(query).ToListAsync(cancellationToken);
    }


    public async Task<IReadOnlyList<BiddingSystemSummary>> ListSeedsAsync(CancellationToken cancellationToken = default) {
        return await Summaries(_db.BiddingSystems.Where(system => system.IsSeed)).ToListAsync(cancellationToken);
    }


    public async Task<SystemOperation<BiddingSystem>> GetAsync(Guid id, Guid userId, bool isAdmin, CancellationToken cancellationToken = default) {
        var record = await _db.BiddingSystems
            .AsNoTracking()
            .AsSplitQuery()
            .Include(system => system.Roots).ThenInclude(root => root.Bids)
            .FirstOrDefaultAsync(system => system.Id == id, cancellationToken);

        if (record == null) {
            return SystemOperation<BiddingSystem>.Fail(SystemAccessResult.NotFound);
        }

        // A seed is only ever opened by an administrator; everyone else forks it and works on the copy.
        if (!CanWrite(record, userId, isAdmin)) {
            return SystemOperation<BiddingSystem>.Fail(SystemAccessResult.Forbidden);
        }

        return SystemOperation<BiddingSystem>.Ok(BiddingSystemMapper.ToDomain(record));
    }


    public async Task<SystemOperation<BiddingSystemSummary>> CreateAsync(string name, BiddingSystem system, Guid userId, bool isAdmin, CancellationToken cancellationToken = default) {
        // Whatever an administrator authors or imports is a seed; that is what "seeds are the administrator's systems" means.
        var owner = isAdmin ? (Guid?)null : userId;
        if (await NameTakenAsync(name, owner, null, cancellationToken)) {
            return SystemOperation<BiddingSystemSummary>.Fail(SystemAccessResult.NameTaken);
        }

        var record = new BiddingSystemRecord { Name = name, OwnerId = owner, IsSeed = isAdmin };
        _db.BiddingSystems.Add(record);

        await WriteTreeAsync(record, system, replaceExisting: false, cancellationToken);
        return SystemOperation<BiddingSystemSummary>.Ok(await SummarizeAsync(record.Id, cancellationToken));
    }


    public async Task<SystemOperation<BiddingSystemSummary>> SaveAsync(Guid id, BiddingSystem system, Guid userId, bool isAdmin, CancellationToken cancellationToken = default) {
        var record = await _db.BiddingSystems.FirstOrDefaultAsync(entity => entity.Id == id, cancellationToken);
        if (record == null) {
            return SystemOperation<BiddingSystemSummary>.Fail(SystemAccessResult.NotFound);
        }

        if (!CanWrite(record, userId, isAdmin)) {
            return SystemOperation<BiddingSystemSummary>.Fail(SystemAccessResult.Forbidden);
        }

        await WriteTreeAsync(record, system, replaceExisting: true, cancellationToken);
        return SystemOperation<BiddingSystemSummary>.Ok(await SummarizeAsync(record.Id, cancellationToken));
    }


    public async Task<SystemOperation<BiddingSystemSummary>> RenameAsync(Guid id, string name, Guid userId, bool isAdmin, CancellationToken cancellationToken = default) {
        var record = await _db.BiddingSystems.FirstOrDefaultAsync(entity => entity.Id == id, cancellationToken);
        if (record == null) {
            return SystemOperation<BiddingSystemSummary>.Fail(SystemAccessResult.NotFound);
        }

        if (!CanWrite(record, userId, isAdmin)) {
            return SystemOperation<BiddingSystemSummary>.Fail(SystemAccessResult.Forbidden);
        }

        if (await NameTakenAsync(name, record.OwnerId, record.Id, cancellationToken)) {
            return SystemOperation<BiddingSystemSummary>.Fail(SystemAccessResult.NameTaken);
        }

        record.Name = name;
        record.ModifiedUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        return SystemOperation<BiddingSystemSummary>.Ok(await SummarizeAsync(record.Id, cancellationToken));
    }


    public async Task<SystemAccessResult> DeleteAsync(Guid id, Guid userId, bool isAdmin, CancellationToken cancellationToken = default) {
        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        var record = await _db.BiddingSystems.FirstOrDefaultAsync(entity => entity.Id == id, cancellationToken);
        if (record == null) {
            return SystemAccessResult.NotFound;
        }

        if (!CanWrite(record, userId, isAdmin)) {
            return SystemAccessResult.Forbidden;
        }

        // The forks outlive their seed. The database clears the reference itself, but the recorded version would be left
        // behind pointing at nothing, so it goes here - a fork whose seed is gone is simply an ordinary system.
        if (record.IsSeed) {
            await _db.BiddingSystems
                .Where(fork => fork.ForkedFromId == record.Id)
                .ExecuteUpdateAsync(setters => setters.SetProperty(fork => fork.ForkedFromVersionUtc, (DateTimeOffset?)null), cancellationToken);
        }

        await ClearTreeAsync(record.Id, cancellationToken);
        _db.BiddingSystems.Remove(record);

        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return SystemAccessResult.Success;
    }


    public async Task<SystemOperation<BiddingSystemSummary>> ForkAsync(Guid seedId, Guid userId, bool isAdmin, CancellationToken cancellationToken = default) {
        // An administrator already owns every seed, so forking one would only produce a duplicate seed.
        if (isAdmin) {
            return SystemOperation<BiddingSystemSummary>.Fail(SystemAccessResult.Forbidden);
        }

        var seed = await LoadTreeAsync(seedId, cancellationToken);
        if (seed == null || !seed.IsSeed) {
            return SystemOperation<BiddingSystemSummary>.Fail(SystemAccessResult.NotFound);
        }

        var record = new BiddingSystemRecord {
            Name = await FreeNameAsync(seed.Name, userId, cancellationToken),
            OwnerId = userId,
            IsSeed = false,
            ForkedFromId = seed.Id,
            ForkedFromVersionUtc = seed.ModifiedUtc
        };

        _db.BiddingSystems.Add(record);

        await WriteTreeAsync(record, BiddingSystemMapper.ToDomain(seed), replaceExisting: false, cancellationToken);
        return SystemOperation<BiddingSystemSummary>.Ok(await SummarizeAsync(record.Id, cancellationToken));
    }


    public async Task<SystemOperation<BiddingSystemSummary>> ReforkAsync(Guid id, Guid userId, bool isAdmin, CancellationToken cancellationToken = default) {
        var record = await _db.BiddingSystems.FirstOrDefaultAsync(entity => entity.Id == id, cancellationToken);
        if (record == null) {
            return SystemOperation<BiddingSystemSummary>.Fail(SystemAccessResult.NotFound);
        }

        if (record.OwnerId != userId || isAdmin) {
            return SystemOperation<BiddingSystemSummary>.Fail(SystemAccessResult.Forbidden);
        }

        if (record.ForkedFromId == null) {
            return SystemOperation<BiddingSystemSummary>.Fail(SystemAccessResult.NotAFork);
        }

        var seed = await LoadTreeAsync(record.ForkedFromId.Value, cancellationToken);
        if (seed == null) {
            return SystemOperation<BiddingSystemSummary>.Fail(SystemAccessResult.NotAFork);
        }

        // Taking the seed again is a full overwrite of the tree. The name stays, because the owner may have chosen their own.
        record.ForkedFromVersionUtc = seed.ModifiedUtc;
        await WriteTreeAsync(record, BiddingSystemMapper.ToDomain(seed), replaceExisting: true, cancellationToken);

        return SystemOperation<BiddingSystemSummary>.Ok(await SummarizeAsync(record.Id, cancellationToken));
    }


    /// <summary>An administrator writes seeds and nothing else; everyone else writes only what they own.</summary>
    private static bool CanWrite(BiddingSystemRecord record, Guid userId, bool isAdmin) {
        return isAdmin ? record.IsSeed : record.OwnerId == userId;
    }


    private static IQueryable<BiddingSystemSummary> Summaries(IQueryable<BiddingSystemRecord> query) {
        return query
            .AsNoTracking()
            .OrderBy(system => system.Name)
            .Select(system => new BiddingSystemSummary(
                system.Id,
                system.Name,
                system.Roots.Count,
                system.Roots.Sum(root => root.Bids.Count),
                system.ModifiedUtc,
                system.IsSeed,
                system.ForkedFromId,
                system.ForkedFrom!.Name,
                system.ForkedFromId != null && system.ForkedFromVersionUtc != null && system.ForkedFrom!.ModifiedUtc > system.ForkedFromVersionUtc));
    }


    private async Task<BiddingSystemSummary> SummarizeAsync(Guid id, CancellationToken cancellationToken) {
        return await Summaries(_db.BiddingSystems.Where(system => system.Id == id)).FirstAsync(cancellationToken);
    }


    private Task<BiddingSystemRecord?> LoadTreeAsync(Guid id, CancellationToken cancellationToken) {
        return _db.BiddingSystems
            .AsNoTracking()
            .AsSplitQuery()
            .Include(system => system.Roots).ThenInclude(root => root.Bids)
            .FirstOrDefaultAsync(system => system.Id == id, cancellationToken);
    }


    private Task<bool> NameTakenAsync(string name, Guid? ownerId, Guid? exceptId, CancellationToken cancellationToken) {
        return _db.BiddingSystems.AnyAsync(system => system.OwnerId == ownerId && system.Name == name && system.Id != exceptId, cancellationToken);
    }


    /// <summary>Appends a counter until the name is free, so forking a seed twice does not collide with the first copy.</summary>
    private async Task<string> FreeNameAsync(string name, Guid ownerId, CancellationToken cancellationToken) {
        if (!await NameTakenAsync(name, ownerId, null, cancellationToken)) {
            return name;
        }

        for (var suffix = 2; ; ++suffix) {
            var candidate = $"{name} ({suffix})";
            if (!await NameTakenAsync(candidate, ownerId, null, cancellationToken)) {
                return candidate;
            }
        }
    }


    /// <summary>Writes the tree of <paramref name="record"/> in one transaction, dropping whatever was there before.</summary>
    private async Task WriteTreeAsync(BiddingSystemRecord record, BiddingSystem system, bool replaceExisting, CancellationToken cancellationToken) {
        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        system.SystemName = record.Name;

        if (replaceExisting) {
            await ClearTreeAsync(record.Id, cancellationToken);
        }

        var (roots, nodes) = BiddingSystemMapper.ToRecords(system, record);
        _db.BiddingRoots.AddRange(roots);
        _db.BidNodes.AddRange(nodes);

        record.ModifiedUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        // The tree is committed and nothing else will touch it through this context. Seeding and forking write several trees
        // in a row, so leaving thousands of rows tracked would make every later change detection pass slower for no benefit.
        Detach(roots);
        Detach(nodes);
    }


    private void Detach<T>(List<T> entities) where T : class {
        foreach (var entity in entities) {
            _db.Entry(entity).State = EntityState.Detached;
        }
    }


    /// <summary>
    /// Removes every root and node of a system. Nodes go first and in one statement: the parent link is deliberately not a
    /// cascade (that would give PostgreSQL two delete paths to the same rows), so the whole subtree has to disappear at once.
    /// </summary>
    private async Task ClearTreeAsync(Guid systemId, CancellationToken cancellationToken) {
        await _db.BidNodes.Where(node => node.Root!.BiddingSystemId == systemId).ExecuteDeleteAsync(cancellationToken);
        await _db.BiddingRoots.Where(root => root.BiddingSystemId == systemId).ExecuteDeleteAsync(cancellationToken);
    }
}
