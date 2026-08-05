using Microsoft.EntityFrameworkCore;
using Model.Bidding.AI;
using Model.Bidding.Bids;
using System.Text.Json;
using Trumpfish.Server.Contracts;
using Trumpfish.Server.Data;

namespace Trumpfish.Server.Services;

public class BiddingSystemStore : IBiddingSystemStore {

    private static readonly JsonSerializerOptions StorageOptions = new(JsonSerializerDefaults.Web) { WriteIndented = true };

    private readonly TrumpfishDbContext _db;


    public BiddingSystemStore(TrumpfishDbContext db) {
        _db = db;
    }


    public async Task<IReadOnlyList<BiddingSystemSummary>> ListAsync(CancellationToken cancellationToken = default) {
        var records = await _db.BiddingSystems.AsNoTracking().OrderBy(e => e.Name).ToListAsync(cancellationToken);
        return records.Select(record => Summarize(record.Name, Deserialize(record.Json), record.ModifiedUtc)).ToList();
    }


    public async Task<BiddingSystem?> GetAsync(string name, CancellationToken cancellationToken = default) {
        var record = await _db.BiddingSystems.AsNoTracking().FirstOrDefaultAsync(e => e.Name == name, cancellationToken);
        if (record == null) {
            return null;
        }

        var system = Deserialize(record.Json);
        system.SystemName = record.Name;
        system.AssignParent();
        return system;
    }


    public async Task<BiddingSystemSummary> SaveAsync(string name, BiddingSystem system, CancellationToken cancellationToken = default) {
        system.SystemName = name;

        var json = JsonSerializer.Serialize(system, StorageOptions);
        var record = await _db.BiddingSystems.FirstOrDefaultAsync(e => e.Name == name, cancellationToken);

        if (record == null) {
            record = new BiddingSystemRecord { Name = name, Json = json };
            _db.BiddingSystems.Add(record);
        }
        else {
            record.Json = json;
        }

        record.ModifiedUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        return Summarize(name, system, record.ModifiedUtc);
    }


    public async Task<bool> DeleteAsync(string name, CancellationToken cancellationToken = default) {
        var record = await _db.BiddingSystems.FirstOrDefaultAsync(e => e.Name == name, cancellationToken);
        if (record == null) {
            return false;
        }

        _db.BiddingSystems.Remove(record);
        await _db.SaveChangesAsync(cancellationToken);
        return true;
    }


    private static BiddingSystem Deserialize(string json) {
        return JsonSerializer.Deserialize<BiddingSystem>(json, StorageOptions) ?? new BiddingSystem();
    }


    private static BiddingSystemSummary Summarize(string name, BiddingSystem system, DateTimeOffset modifiedUtc) {
        return new BiddingSystemSummary(name, system.Roots.Count, system.Roots.Sum(root => CountBids(root.Bids)), modifiedUtc);
    }


    private static int CountBids(IEnumerable<BidNode> bids) {
        return bids.Sum(bid => 1 + CountBids(bid.NextBids));
    }
}
