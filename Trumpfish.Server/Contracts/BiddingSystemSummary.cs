namespace Trumpfish.Server.Contracts;

/// <summary>Lightweight description of a stored bidding system, used by the client to render the "load" list.</summary>
public record BiddingSystemSummary(string Name, int RootCount, int BidCount, DateTimeOffset ModifiedUtc);
