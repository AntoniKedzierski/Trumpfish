using Model.Bidding.AI;
using Trumpfish.Server.Contracts;

namespace Trumpfish.Server.Services;

/// <summary>Outcome of a practice command: either the new state of the table, or why the command was refused.</summary>
public record PracticeResult(PracticeState? State, string? Problem);

public interface IPracticeService {

    /// <summary>Deals a new hand and lets the bots bid up to the human's first turn.</summary>
    PracticeResult Start(BiddingSystem system, PracticeStartRequest request);

    /// <summary>Reads back the opaque state a client returned. Null when it is missing, tampered with or no longer readable.</summary>
    PracticeStateData? Restore(string state);

    /// <summary>Adds the human's bid and lets the bots answer, up to the human's next turn or the end of the auction.</summary>
    PracticeResult Bid(BiddingSystem system, PracticeStateData data, PracticeStoredBid bid);

    /// <summary>What the engine would bid in the human's seat right now, or null when it is not his turn to bid at all.</summary>
    PracticeHint? Hint(BiddingSystem system, PracticeStateData data);
}
