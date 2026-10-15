using System.Diagnostics;
using Model;
using Model.Bidding.AI;
using Model.Bidding.Bids;
using Model.Enums;
using Model.Helpers;
using Trumpfish.Server.Contracts;

namespace Trumpfish.Server.Services;

/// <summary>A deal found for a convention, already turned so that the human seat is the one the exercise is about.</summary>
internal sealed record ConventionDeal(Dictionary<PlayerPosition, Hand> Hands, PlayerPosition Dealer);

/// <summary>
/// Finds a deal on which the bots use a given convention. Unlike an opening, a convention can turn up anywhere in an auction and
/// depends on all four hands, so no single hand can be built to fit it: whole deals are bid out by the bots until one of them
/// makes a bid carrying that convention.
/// </summary>
/// <remarks>
/// A deal is bid out in a fraction of a millisecond, so thousands of tries fit in a request. Most of them are aimed: when the
/// convention lives under openings of the system, the dealer is given a hand for one of those openings, which is what makes the
/// rarer conventions findable at all. The rest of the tries are plain random deals, so conventions reached some other way - from
/// the defences, or through a continuation - still turn up.
/// </remarks>
internal static class ConventionDealer {

    /// <summary>Upper bound on deals bid out for one request; the time limit below normally ends the search first.</summary>
    private const int MaxAttempts = 20000;

    /// <summary>How long one request may search before telling the player the convention is too rare to find.</summary>
    private static readonly TimeSpan TimeLimit = TimeSpan.FromSeconds(4);

    /// <summary>Share of tries dealt to fit an opening the convention lives under, when there is one.</summary>
    private const double AimedShare = 0.75;


    /// <summary>
    /// Key a convention is matched by. Names in a system are typed by hand - "Cue-bid", "cue bid", "Kontra objaśniająca." - so
    /// case, spaces and punctuation are ignored. The client groups its list by exactly the same rule.
    /// </summary>
    public static string Key(string? name) {
        return string.Concat((name ?? string.Empty).Where(char.IsLetterOrDigit)).ToLowerInvariant();
    }


    /// <summary>Every bid of the system carrying the convention that the engine can reach, i.e. that sits under no switched-off bid.</summary>
    public static HashSet<BidNode> NodesOf(BiddingSystem system, string key) {
        return system.AllNodes()
            .Where(node => Key(node.Convention) == key && node.GetPath().All(step => !step.IsDisabled))
            .ToHashSet<BidNode>(ReferenceEqualityComparer.Instance);
    }


    /// <summary>
    /// Searches for a deal on which the convention is bid, and turns it so that <paramref name="seat"/> is the one who bids it
    /// (<see cref="PracticeRole.Opener"/>) or the partner who has to answer it (<see cref="PracticeRole.Responder"/>). With
    /// <paramref name="opening"/> given, the auction also has to start with that very opening. Null when nothing was found
    /// within the limits.
    /// </summary>
    public static ConventionDeal? Find(BiddingSystem system, HashSet<BidNode> conventionNodes, BidNode? opening, PracticeRole role, Random random, PlayerPosition seat = PlayerPosition.South) {
        List<BidNode> aims = opening != null ? [opening] : OpeningsAbove(system, conventionNodes);
        var clock = Stopwatch.StartNew();

        for (var attempt = 0; attempt < MaxAttempts && clock.Elapsed < TimeLimit; attempt++) {
            var dealer = (PlayerPosition)random.Next(4);
            var aim = aims.Count > 0 && (opening != null || random.NextDouble() < AimedShare) ? aims[random.Next(aims.Count)] : null;

            // The opening hand goes to the dealer, who speaks first and so actually gets to open with it.
            var hands = PracticeDealer.Deal(random, aim, dealer);
            if (hands == null) {
                // Only an opening whose ranges contradict each other gets here; when the player chose it, no try can do better.
                if (opening != null) {
                    return null;
                }

                continue;
            }

            var bidder = ConventionBidder(system, hands, dealer, conventionNodes, opening);
            if (bidder == null) {
                continue;
            }

            // Turned so that the seat the exercise is about lands where the human sits.
            var focus = role == PracticeRole.Opener ? bidder.Value : bidder.Value.GetPartner();
            var turn = ((int)seat - (int)focus + 4) % 4;
            var turned = new ConventionDeal(hands.ToDictionary(entry => Rotate(entry.Key, turn), entry => entry.Value), Rotate(dealer, turn));

            // The engine plays every seat alike, so the turned deal bids out the same - checked anyway, since a deal that does not
            // reproduce would hand the player an exercise that never comes.
            if (ConventionBidder(system, turned.Hands, turned.Dealer, conventionNodes, opening) == Rotate(bidder.Value, turn)) {
                return turned;
            }
        }

        return null;
    }


    /// <summary>
    /// Bids the deal out with four bots and returns the seat that made the first bid carrying the convention, or null when nobody
    /// did - or when an opening was asked for and the auction did not start with it.
    /// </summary>
    private static PlayerPosition? ConventionBidder(BiddingSystem system, IReadOnlyDictionary<PlayerPosition, Hand> hands, PlayerPosition dealer, HashSet<BidNode> conventionNodes, BidNode? opening) {
        var replay = TableEngine.Replay(system, hands, dealer, [], [], false, 0);
        if (replay.Error != null) {
            return null;
        }

        var history = replay.Auction.AuctionHistory;

        if (opening != null) {
            var opened = history.FirstOrDefault(bid => bid.Type != BidType.Pass);
            if (!ReferenceEquals(opened, opening)) {
                return null;
            }
        }

        // The engine hands back the system's own node for a system bid, so being one of the convention's nodes is the test.
        // A natural bid is a node made up on the spot and never matches, whatever its wording.
        for (var i = 0; i < history.Count; i++) {
            if (history[i] is BidNode node && conventionNodes.Contains(node)) {
                return replay.Auction.GetBidder(i);
            }
        }

        return null;
    }


    /// <summary>The openings the convention's bids hang under. Bids in other roots are reached some other way and add nothing here.</summary>
    private static List<BidNode> OpeningsAbove(BiddingSystem system, IEnumerable<BidNode> conventionNodes) {
        var openings = TableEngine.OpeningsRoot(system)?.Bids ?? [];

        return conventionNodes
            .Select(node => node.GetPath()[0])
            .Where(top => openings.Any(opening => ReferenceEquals(opening, top)))
            .Distinct()
            .ToList();
    }


    private static PlayerPosition Rotate(PlayerPosition position, int turn) {
        return (PlayerPosition)(((int)position + turn) % 4);
    }
}
