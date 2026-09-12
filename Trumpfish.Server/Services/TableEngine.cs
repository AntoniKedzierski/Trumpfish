using Model;
using Model.Bidding;
using Model.Bidding.AI;
using Model.Bidding.AI.Engine;
using Model.Bidding.Bids;
using Model.Enums;
using Trumpfish.Server.Contracts;

namespace Trumpfish.Server.Services;

/// <summary>One warning of a replayed auction, along with the seat it was raised against.</summary>
internal sealed record SeatedWarning(PlayerPosition Seat, PracticeWarning Warning);

/// <summary>
/// A replayed auction, stopped at the first human turn that has no bid stored for it. Everything a caller needs to describe the
/// table is here: who is waiting, what the engine would say in that seat, and - once it is over - the finished deal.
/// </summary>
internal sealed record TableReplay(
    Auction Auction,
    Player[] Players,
    IReadOnlyDictionary<PlayerPosition, Hand> Hands,
    IReadOnlyList<SimulationBid> Bidding,
    IReadOnlyList<SeatedWarning> Warnings,
    PlayerPosition? Waiting,
    Bid? Advice,
    PracticeLegalBids Legal,
    bool Finished,
    string? Error) {

    /// <summary>Every warning raised against one seat, which is the only part of them that seat may see.</summary>
    public IReadOnlyList<PracticeWarning> WarningsFor(PlayerPosition seat) {
        return [.. Warnings.Where(entry => entry.Seat == seat).Select(entry => entry.Warning)];
    }
}

/// <summary>
/// Runs an auction in which some seats are played by people and the rest by the engine. The human bids arrive as a flat list in
/// the order they were made: human turns come round in a fixed order, so a queue is enough to put each bid back in its seat.
/// </summary>
/// <remarks>
/// Shared by the solo practice table, which replays the whole auction on every request from the state the client carries, and by
/// the two-player table, which replays it from the session the server holds. Neither keeps the bots bids: the engine is
/// deterministic, so replaying from the deal reproduces them exactly.
/// </remarks>
internal static class TableEngine {

    /// <summary>Hard stop for pathological auctions, so a broken system tree cannot hang a request.</summary>
    private const int MaxBids = 60;


    public static TableReplay Replay(BiddingSystem system, IReadOnlyDictionary<PlayerPosition, Hand> hands, PlayerPosition dealer, IReadOnlyCollection<PlayerPosition> humanSeats, IReadOnlyList<PracticeStoredBid> bids, bool checkBids, int dealIndex) {
        var auction = new Auction();
        var players = new Player[4];

        foreach (var position in Enum.GetValues<PlayerPosition>()) {
            players[(int)position] = new Player("bot", position, new BidEngine(auction, position, system, dealIndex));
            players[(int)position].GiveHand(hands[position]);
        }

        auction.Start(dealer);

        var pending = new Queue<PracticeStoredBid>(bids);
        var warnings = new List<SeatedWarning>();
        PlayerPosition? waiting = null;
        Bid? pendingAdvice = null;
        string? error = null;

        try {
            while (!auction.IsCompleted()) {
                if (auction.AuctionHistory.Count >= MaxBids) {
                    error = "Licytacja nie zakończyła się w dopuszczalnej liczbie odzywek.";
                    break;
                }

                var seat = auction.CurrentBidder;

                if (humanSeats.Contains(seat)) {
                    // Always asked, and asked before the human speaks: the engine reasons from its own bids, so skipping a turn
                    // would leave it out of step with the auction. Whether anyone gets to read the answer is decided elsewhere.
                    var advice = Advice(players[(int)seat]);

                    if (pending.Count == 0) {
                        waiting = seat;
                        pendingAdvice = advice;
                        break;
                    }

                    var bid = ToBid(pending.Dequeue());
                    auction.Submit(bid);

                    // Explained only after it is in the history: what a bid means follows from the sequence it belongs to.
                    var matches = Explain(system, auction, seat, bid);

                    if (checkBids) {
                        var warning = Check(bid, matches, hands[seat], advice, auction.AuctionHistory.Count - 1);
                        if (warning != null) {
                            warnings.Add(new SeatedWarning(seat, warning));
                        }
                    }
                }
                else {
                    auction.Submit(players[(int)seat].MakeBid());
                }
            }
        }
        catch (Exception exception) {
            error = exception.Message;
        }

        var finished = error != null || auction.IsCompleted();

        return new TableReplay(
            auction,
            players,
            hands,
            AuctionMapping.MapBidding(auction),
            warnings,
            finished ? null : waiting,
            pendingAdvice,
            PracticeRules.Describe(auction),
            finished,
            error);
    }


    /// <summary>The finished deal in exactly the shape the batch simulator produces, which is what reveals every hand at once.</summary>
    public static SimulationDealResult Result(TableReplay replay, int dealIndex, PlayerPosition dealer) {
        var contract = AuctionMapping.PassedOut();
        var error = replay.Error;

        if (error == null) {
            try {
                contract = AuctionMapping.MapContract(replay.Auction, replay.Players, replay.Hands);
            }
            catch (Exception exception) {
                error = exception.Message;
            }
        }

        return new SimulationDealResult(dealIndex, dealer, AuctionMapping.MapHands(replay.Hands), replay.Bidding, contract, error);
    }


    public static PracticeBidLabel Label(Bid bid) {
        return new PracticeBidLabel(bid.Type, bid.Color, bid.Value, AuctionMapping.Describe(bid));
    }


    public static Bid ToBid(PracticeStoredBid bid) {
        return new Bid { Type = bid.Type, Color = bid.Color, Value = bid.Value };
    }


    /// <summary>
    /// What the engine would have said in a human seat, or null when it cannot answer here. Asking it moves its own line of
    /// thought forward, so it must be asked at every turn of that seat rather than only at the interesting ones.
    /// </summary>
    private static Bid? Advice(Player player) {
        try {
            return player.MakeBid();
        }
        catch (Exception) {
            // A system that leads the engine into an illegal bid is a fault of the tree, not something to fail the deal over.
            return null;
        }
    }


    /// <summary>
    /// Whether the bid the human just made was the wrong thing to say holding this hand. It was when the system has the bid
    /// here but under conditions the hand does not meet, or does not have it at all and the engine would have said something
    /// else. A bid the engine itself would have made is right by definition: the tree simply left room for a natural call.
    /// </summary>
    /// <remarks>
    /// Only a suit or no-trump bid is judged. A pass, a double and a redouble say nothing about points or shape on their own,
    /// so there is no promise to hold them to.
    /// </remarks>
    private static PracticeWarning? Check(Bid bid, List<BidNode> matches, Hand hand, Bid? advice, int bidIndex) {
        if (bid.Type != BidType.Submit || matches.Any(node => node.Matches(hand)) || Same(bid, advice)) {
            return null;
        }

        return new PracticeWarning(
            bidIndex,
            Label(bid),
            matches.Count == 0 ? null : bid.Explanation,
            advice == null ? null : Label(advice),
            advice?.Explanation);
    }


    /// <summary>
    /// Whether two bids are the same call. Compared field by field rather than with <c>Bid.Equals</c>, which treats a missing
    /// level as matching any level - fine for looking a bid up in the tree, far too generous for judging one.
    /// </summary>
    private static bool Same(Bid bid, Bid? other) {
        return other != null && bid.Type == other.Type && bid.Color == other.Color && bid.Value == other.Value;
    }


    /// <summary>
    /// Says what a human bid means by finding it in the system tree, walking the pair own sequence down from the openings
    /// (or, when the pair did not open, from the defences). Nothing found means the bid is not in the system at this point.
    /// </summary>
    /// <returns>The nodes the bid landed on, which is also what says whether the hand could hold it.</returns>
    private static List<BidNode> Explain(BiddingSystem system, Auction auction, PlayerPosition player, Bid bid) {
        if (bid.Type == BidType.Pass) {
            bid.Explanation = "Pas.";
            return [];
        }

        var sequence = auction.GetPlayersSequence(player, out _).Where(entry => entry.Type != BidType.Pass).ToList();
        var openings = OpeningsRoot(system);
        var matches = openings == null ? [] : Match(system, openings, sequence);

        if (matches.Count == 0) {
            var defences = system.Defences();
            matches = defences == null ? [] : Match(system, defences, sequence);
        }

        bid.IsFromSystem = matches.Count > 0;
        bid.Explanation = matches.Count == 0
            ? "Odzywka spoza systemu - drzewo nie przewiduje jej w tym miejscu licytacji."
            : string.Join("  ·  ", matches.Select(DescribeNode).Distinct());

        return matches;
    }


    /// <summary>Walks a root by the pair sequence and returns the nodes the last bid of it lands on - usually one, sometimes several.</summary>
    private static List<BidNode> Match(BiddingSystem system, Root root, List<InterruptedBid> sequence) {
        if (sequence.Count == 0) {
            return [];
        }

        var children = root.Bids.Where(node => !node.IsDisabled).ToList();
        for (var i = 0; i < sequence.Count - 1; i++) {
            children = system.GetMatchingChildren(children, sequence[i]);
        }

        var last = sequence[^1];

        return children
            .Where(node => !node.IsDisabled && node.Equals((Bid)last))
            .Where(node => last.Interruption == null
                ? node.Interjection == null
                : node.Interjection != null && node.Interjection.Equals(last.Interruption))
            .ToList();
    }


    private static string DescribeNode(BidNode node) {
        var parts = new List<string>();

        if (!string.IsNullOrWhiteSpace(node.Condition)) {
            parts.Add(node.Condition.Trim());
        }

        if (!string.IsNullOrWhiteSpace(node.Convention)) {
            parts.Add($"⟨{node.Convention.Trim()}⟩");
        }

        if (parts.Count == 0 && !string.IsNullOrWhiteSpace(node.Description)) {
            parts.Add(node.Description.Trim());
        }

        return parts.Count == 0 ? "Odzywka z systemu, bez opisu." : string.Join(" ", parts);
    }


    /// <summary>The openings root, or null when the system has none. Unlike <c>BiddingSystem.Openings</c> this does not throw.</summary>
    public static Root? OpeningsRoot(BiddingSystem system) {
        return system.Roots.FirstOrDefault(root => root.Name == BiddingSystem.OpeningsRootName);
    }


    public static BidNode? FindOpening(BiddingSystem system, Guid? nodeId) {
        return nodeId == null ? null : OpeningsRoot(system)?.Bids.FirstOrDefault(node => node.NodeId == nodeId.Value);
    }


    /// <summary>A named seed makes a whole session reproducible, deal by deal. Without one every deal is genuinely random.</summary>
    public static Random RandomFor(string? seed, int dealIndex) {
        return string.IsNullOrWhiteSpace(seed) ? new Random() : new Random(StableHash(seed.Trim()) ^ dealIndex);
    }


    /// <summary>
    /// FNV-1a. String hashing in .NET is randomised per process, so a seed hashed with it would deal differently after every
    /// restart - which is precisely what a seed is supposed to rule out.
    /// </summary>
    private static int StableHash(string text) {
        var hash = 2166136261;

        foreach (var character in text) {
            hash = (hash ^ character) * 16777619;
        }

        return unchecked((int)hash);
    }
}
