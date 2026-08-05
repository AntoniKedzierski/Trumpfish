using Model.Bidding.AI;
using Trumpfish.Server.Contracts;

namespace Trumpfish.Server.Services;

public interface IBiddingSystemStore {

    Task<IReadOnlyList<BiddingSystemSummary>> ListAsync(CancellationToken cancellationToken = default);

    Task<BiddingSystem?> GetAsync(string name, CancellationToken cancellationToken = default);

    Task<BiddingSystemSummary> SaveAsync(string name, BiddingSystem system, CancellationToken cancellationToken = default);

    Task<bool> DeleteAsync(string name, CancellationToken cancellationToken = default);
}
