using Microsoft.AspNetCore.DataProtection;
using Model;
using Model.Bidding;
using Model.Bidding.AI;
using Model.Bidding.AI.Engine;
using Model.Bidding.Bids;
using Model.Enums;
using System.Text.Json;
using Trumpfish.Server.Contracts;

namespace Trumpfish.Server.Services;

/// <summary>
/// Sits the human down at a table with three bots. Nothing is kept on the server: every request rebuilds the deal from the
/// opaque state the client carries, replays the auction through the engine and stops as soon as it is the human's turn again.
/// </summary>
public class PracticeService : IPracticeService {

    /// <summary>Hard stop for pathological auctions, so a broken system tree cannot hang a request.</summary>
    private const int MaxBids = 60;

    /// <summary>The human always sits South, so the table is drawn the same way every time.</summary>
    private const PlayerPosition HumanSeat = PlayerPosition.South;

    private static readonly JsonSerializerOptions StateJson = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    private readonly IDataProtector _protector;


    public PracticeService(IDataProtectionProvider protection) {
        // Signed rather than merely encoded: the hands the client must not see yet travel through it, and so does the deal it
        // will be graded on. A client cannot read them out and cannot hand back a deal it made up.
        _protector = protection.CreateProtector("Trumpfish.Practice.v1");
    }


    public PracticeResult Start(BiddingSystem system, PracticeStartRequest request) {
        var opening = FindOpening(system, request.OpeningNodeId);
        if (request.OpeningNodeId != null && opening == null) {
            return new PracticeResult(null, "Nie znaleziono ćwiczonego otwarcia w tym systemie.");
        }

        // Practising as the responder means the partner is the one who has to be able to open, so the hand goes to him instead.
        var targetSeat = request.Role == PracticeRole.Responder ? PlayerPosition.North : HumanSeat;
        var hands = PracticeDealer.Deal(RandomFor(request.Seed, request.DealIndex), opening, targetSeat);

        if (hands == null) {
            return new PracticeResult(null, "Nie da się rozdać ręki spełniającej warunki tego otwarcia - sprawdź zakresy punktów i kart.");
        }

        var data = new PracticeStateData(
            request.SystemId,
            request.DealIndex,
            // Every deal is started by the next player round the table, so the human bids from a different position each time.
            (PlayerPosition)(((request.DealIndex % 4) + 4) % 4),
            HumanSeat,
            request.OpeningNodeId,
            request.CheckBids,
            [.. Enum.GetValues<PlayerPosition>().Select(position => CardCodec.Encode(hands[position].Cards))],
            []);

        return new PracticeResult(Replay(system, data).State, null);
    }


    public PracticeStateData? Restore(string state) {
        if (string.IsNullOrWhiteSpace(state)) {
            return null;
        }

        try {
            return JsonSerializer.Deserialize<PracticeStateData>(_protector.Unprotect(state), StateJson);
        }
        catch (Exception) {
            // A state that no longer unprotects is one from an older key or a tampered one; either way there is no deal to resume.
            return null;
        }
    }


    public PracticeResult Bid(BiddingSystem system, PracticeStateData data, PracticeStoredBid bid) {
        var current = Replay(system, data);

        if (current.State.Finished) {
            return new PracticeResult(null, "Licytacja tego rozdania jest już zakończona.");
        }

        if (!current.State.PlayerToBid) {
            return new PracticeResult(null, "To nie jest teraz twoja kolej.");
        }

        if (!PracticeRules.IsLegal(current.Auction, ToBid(bid))) {
            return new PracticeResult(null, "Ta odzywka jest nielegalna w tym miejscu licytacji.");
        }

        return new PracticeResult(Replay(system, data with { Bids = [.. data.Bids, bid] }).State, null);
    }


    public PracticeHint? Hint(BiddingSystem system, PracticeStateData data) {
        var current = Replay(system, data);
        if (!current.State.PlayerToBid) {
            return null;
        }

        var advice = current.Advice;
        return advice == null ? new PracticeHint(null, null) : new PracticeHint(Label(advice), advice.Explanation);
    }


    /// <summary>
    /// The auction as it stands, plus the state to send back. Kept together so a bid can be checked against the live auction,
    /// and so the engine's answer for the turn being waited on is there if the player asks to be told it.
    /// </summary>
    private sealed record Replayed(PracticeState State, Auction Auction, Bid? Advice);


    /// <summary>
    /// Rebuilds the deal and runs the auction: the human's stored bids are fed in at his seat, every other seat is bid by the
    /// engine. It stops when the human is on turn with nothing stored left to play, which is exactly where the client picks up.
    /// </summary>
    private Replayed Replay(BiddingSystem system, PracticeStateData data) {
        var hands = Decode(data);
        var auction = new Auction();
        var players = new Player[4];

        foreach (var position in Enum.GetValues<PlayerPosition>()) {
            players[(int)position] = new Player("bot", position, new BidEngine(auction, position, system));
            players[(int)position].GiveHand(hands[position]);
        }

        auction.Start(data.Dealer);

        var pending = new Queue<PracticeStoredBid>(data.Bids);
        var warnings = new List<PracticeWarning>();
        var waiting = false;
        Bid? pendingAdvice = null;
        string? error = null;

        try {
            while (!auction.IsCompleted()) {
                if (auction.AuctionHistory.Count >= MaxBids) {
                    error = "Licytacja nie zakończyła się w dopuszczalnej liczbie odzywek.";
                    break;
                }

                if (auction.CurrentBidder == data.Player) {
                    // Always asked, and asked before the human speaks: the engine reasons from its own bids, so skipping a turn
                    // would leave it out of step with the auction. Whether anyone gets to read the answer is decided elsewhere.
                    var advice = Advice(players[(int)data.Player], data.DealIndex);

                    if (pending.Count == 0) {
                        waiting = true;
                        pendingAdvice = advice;
                        break;
                    }

                    var bid = ToBid(pending.Dequeue());
                    auction.Submit(bid);

                    // Explained only after it is in the history: what a bid means follows from the sequence it belongs to.
                    var matches = Explain(system, auction, data.Player, bid);

                    if (data.CheckBids) {
                        var warning = Check(bid, matches, hands[data.Player], advice, auction.AuctionHistory.Count - 1);
                        if (warning != null) {
                            warnings.Add(warning);
                        }
                    }
                }
                else {
                    auction.Submit(players[(int)auction.CurrentBidder].MakeBid(data.DealIndex));
                }
            }
        }
        catch (Exception exception) {
            error = exception.Message;
        }

        var finished = error != null || auction.IsCompleted();
        var state = new PracticeState(
            _protector.Protect(JsonSerializer.Serialize(data, StateJson)),
            data.DealIndex,
            data.Dealer,
            data.Player,
            AuctionMapping.MapHand(data.Player, hands[data.Player]),
            AuctionMapping.MapBidding(auction),
            warnings,
            waiting && !finished,
            PracticeRules.Describe(auction),
            finished,
            finished ? Result(auction, players, hands, data, error) : null,
            error);

        return new Replayed(state, auction, pendingAdvice);
    }


    /// <summary>The finished deal in exactly the shape the batch simulator produces, which is what reveals every hand at once.</summary>
    private static SimulationDealResult Result(Auction auction, Player[] players, Dictionary<PlayerPosition, Hand> hands, PracticeStateData data, string? error) {
        var contract = AuctionMapping.PassedOut();

        if (error == null) {
            try {
                contract = AuctionMapping.MapContract(auction, players, hands);
            }
            catch (Exception exception) {
                error = exception.Message;
            }
        }

        return new SimulationDealResult(data.DealIndex, data.Dealer, AuctionMapping.MapHands(hands), AuctionMapping.MapBidding(auction), contract, error);
    }


    /// <summary>
    /// What the engine would have said in the human's seat, or null when it cannot answer here. Asking it moves its own line of
    /// thought forward, so it must be asked at every turn of that seat rather than only at the interesting ones.
    /// </summary>
    private static Bid? Advice(Player player, int dealIndex) {
        try {
            return player.MakeBid(dealIndex);
        }
        catch (Exception) {
            // A system that leads the engine into an illegal bid is a fault of the tree, not something to fail the deal over.
            return null;
        }
    }


    /// <summary>
    /// Whether the bid the human just made can be true of the hand he is holding. It cannot when the system does not have the
    /// bid here at all, or has it but under conditions this hand does not meet - which is exactly the mistake worth naming.
    /// </summary>
    /// <remarks>
    /// Only a suit or no-trump bid is judged. A pass, a double and a redouble say nothing about points or shape on their own,
    /// so there is no promise to hold them to.
    /// </remarks>
    private static PracticeWarning? Check(Bid bid, List<BidNode> matches, Hand hand, Bid? advice, int bidIndex) {
        if (bid.Type != BidType.Submit || matches.Any(node => node.Matches(hand))) {
            return null;
        }

        return new PracticeWarning(
            bidIndex,
            Label(bid),
            matches.Count == 0 ? null : bid.Explanation,
            $"{hand.Points} PC, {hand.SpadesCount}-{hand.HeartsCount}-{hand.DiamondsCount}-{hand.ClubsCount}",
            advice == null ? null : Label(advice),
            advice?.Explanation);
    }


    private static PracticeBidLabel Label(Bid bid) {
        return new PracticeBidLabel(bid.Type, bid.Color, bid.Value, AuctionMapping.Describe(bid));
    }


    /// <summary>
    /// Says what the human's bid means by finding it in the system tree, walking the pair's own sequence down from the openings
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


    /// <summary>Walks a root by the pair's sequence and returns the nodes the last bid of it lands on - usually one, sometimes several.</summary>
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


    private static BidNode? FindOpening(BiddingSystem system, Guid? nodeId) {
        return nodeId == null ? null : OpeningsRoot(system)?.Bids.FirstOrDefault(node => node.NodeId == nodeId.Value);
    }


    /// <summary>The openings root, or null when the system has none. Unlike <c>BiddingSystem.Openings</c> this does not throw.</summary>
    private static Root? OpeningsRoot(BiddingSystem system) {
        return system.Roots.FirstOrDefault(root => root.Name == BiddingSystem.OpeningsRootName);
    }


    private static Bid ToBid(PracticeStoredBid bid) {
        return new Bid { Type = bid.Type, Color = bid.Color, Value = bid.Value };
    }


    private static Dictionary<PlayerPosition, Hand> Decode(PracticeStateData data) {
        return Enum.GetValues<PlayerPosition>()
            .ToDictionary(position => position, position => new Hand(CardCodec.Decode(data.Hands[(int)position]) ?? throw new InvalidOperationException("Uszkodzony stan rozdania.")));
    }


    /// <summary>
    /// A named seed makes a whole practice session reproducible, deal by deal. Without one every deal is genuinely random.
    /// </summary>
    private static Random RandomFor(string? seed, int dealIndex) {
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
