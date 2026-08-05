using Model.Bidding.AI;
using Trumpfish.Server.Contracts;

namespace Trumpfish.Server.Services;

public interface IBiddingSimulator {

    SimulationResponse Simulate(BiddingSystem system, SimulationRequest request);
}
