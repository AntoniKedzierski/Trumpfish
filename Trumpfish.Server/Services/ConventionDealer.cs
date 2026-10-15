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
/// Finds a deal on which the bots use a given convention, or make a given defence. Unlike an opening, either can only come up
/// once somebody else has bid and so depends on more than one hand, so no single hand can be built to fit it: whole deals are bid
/// out by the bots until one of them makes the bid looked for.
/// </summary>
/// <remarks>
/// A deal is bid out in a fraction of a millisecond, so thousands of tries fit in a request. Most of them are aimed: when the
/// convention lives under openings of the system, the dealer is given a hand for one of those openings, and when it lives under a
/// defence, the player after him is given a hand for that defence - which is what makes the rarer ones findable at all. The rest
/// of the tries are plain random deals, so conventions reached some other way - through a continuation - still turn up.
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
    /// Searches for a deal on which one of <paramref name="targets"/> is bid, and turns it so that <paramref name="seat"/> is the one
    /// who bids it (<see cref="PracticeRole.Opener"/>) or the partner who has to answer it (<see cref="PracticeRole.Responder"/>).
    /// With <paramref name="opening"/> given, the auction also has to start with that very opening; with <paramref name="defence"/>
    /// given, it has to contain that defence and the target has to come from it on - which makes a defence its own target when it
    /// is practised alone. Null when nothing was found within the limits.
    /// </summary>
    public static ConventionDeal? Find(BiddingSystem system, HashSet<BidNode> targets, BidNode? opening, BidNode? defence, PracticeRole role, Random random, PlayerPosition seat = PlayerPosition.South) {
        // A chosen opening or defence is dealt for on every try: the search is pointless on a deal that cannot contain it.
        var forced = opening != null || defence != null;
        List<Aim> aims = opening != null ? [new Aim(opening, 0)] : defence != null ? [new Aim(defence, 1)] : AimsFor(system, targets);
        var clock = Stopwatch.StartNew();

        for (var attempt = 0; attempt < MaxAttempts && clock.Elapsed < TimeLimit; attempt++) {
            var dealer = (PlayerPosition)random.Next(4);
            Aim? aim = aims.Count > 0 && (forced || random.NextDouble() < AimedShare) ? aims[random.Next(aims.Count)] : null;

            var hands = PracticeDealer.Deal(random, aim?.Node, Rotate(dealer, aim?.SeatsAfterDealer ?? 0));
            if (hands == null) {
                // Only a bid whose ranges contradict each other gets here; when the player chose it, no try can do better.
                if (forced) {
                    return null;
                }

                continue;
            }

            var bidder = TargetBidder(system, hands, dealer, targets, opening, defence);
            if (bidder == null) {
                continue;
            }

            // Turned so that the seat the exercise is about lands where the human sits.
            var focus = role == PracticeRole.Opener ? bidder.Value : bidder.Value.GetPartner();
            var turn = ((int)seat - (int)focus + 4) % 4;
            var turned = new ConventionDeal(hands.ToDictionary(entry => Rotate(entry.Key, turn), entry => entry.Value), Rotate(dealer, turn));

            // The engine plays every seat alike, so the turned deal bids out the same - checked anyway, since a deal that does not
            // reproduce would hand the player an exercise that never comes.
            if (TargetBidder(system, turned.Hands, turned.Dealer, targets, opening, defence) == Rotate(bidder.Value, turn)) {
                return turned;
            }
        }

        return null;
    }


    /// <summary>A hand to deal for, and which seat gets it, counted from the dealer round the table.</summary>
    private readonly record struct Aim(BidNode Node, int SeatsAfterDealer);


    /// <summary>
    /// Bids the deal out with four bots and returns the seat that made the first bid out of <paramref name="targets"/>, or null when
    /// nobody did - or when the auction did not start with <paramref name="opening"/>, or never had <paramref name="defence"/> in it.
    /// </summary>
    private static PlayerPosition? TargetBidder(BiddingSystem system, IReadOnlyDictionary<PlayerPosition, Hand> hands, PlayerPosition dealer, HashSet<BidNode> targets, BidNode? opening, BidNode? defence) {
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

        // From the defence on, the defence itself included: practised alone, it is the very bid looked for.
        var from = defence == null ? 0 : history.FindIndex(bid => ReferenceEquals(bid, defence));
        if (from < 0) {
            return null;
        }

        // The engine hands back the system's own node for a system bid, so being one of the targets is the test. A natural bid is
        // a node made up on the spot and never matches, whatever its wording.
        for (var i = from; i < history.Count; i++) {
            if (history[i] is BidNode node && targets.Contains(node)) {
                return replay.Auction.GetBidder(i);
            }
        }

        return null;
    }


    /// <summary>
    /// What to deal for when only the targets are known: the openings they hang under go to the dealer, and the defences they hang
    /// under to the player after him, who is the one to answer the opening. Bids in other roots are reached some other way and add
    /// nothing here.
    /// </summary>
    private static List<Aim> AimsFor(BiddingSystem system, IEnumerable<BidNode> targets) {
        var openings = TableEngine.OpeningsRoot(system)?.Bids ?? [];
        var tops = targets.Select(node => node.GetPath()[0]).Distinct().ToList();

        return [
            .. tops.Where(top => openings.Any(opening => ReferenceEquals(opening, top))).Select(top => new Aim(top, 0)),
            .. tops.Where(top => ReferenceEquals(TableEngine.FindDefence(system, top.NodeId), top)).Select(top => new Aim(top, 1)),
        ];
    }


    private static PlayerPosition Rotate(PlayerPosition position, int turn) {
        return (PlayerPosition)(((int)position + turn) % 4);
    }
}
