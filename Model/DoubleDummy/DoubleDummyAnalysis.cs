using Model.Enums;
using Model.Helpers;
using Model.Scoring;

namespace Model.DoubleDummy;

/// <summary>
/// What the solver has to say about one deal: the full table of tricks, and the par result derived from it for the dealer
/// and vulnerability the deal was played at.
/// </summary>
/// <param name="ParScore">The par score from north-south's point of view, so a positive number is east-west going wrong.</param>
/// <param name="ParContracts">
/// Every contract that reaches par. There is usually one, but a deal can have several equally good ones - the same contract
/// from either seat of a pair, or a choice between denominations.
/// </param>
public record DoubleDummyAnalysis(
    PlayerPosition Dealer,
    Vulnerability Vulnerability,
    DoubleDummyTable Table,
    int ParScore,
    IReadOnlyList<ParContract> ParContracts) {

    /// <summary>The side par favours, or null on a deal the two sides split down the middle.</summary>
    public Pair? ParPair => ParScore switch {
        > 0 => Model.Enums.Pair.NorthSouth,
        < 0 => Model.Enums.Pair.EastWest,
        _ => null
    };

    /// <summary>
    /// The contract to show when there is only room for one: the first one par found that nobody is sacrificing with.
    /// Falls back to the first par contract on a deal where the cheapest sacrifice is the par call.
    /// </summary>
    public ParContract? BestContract => ParContracts.FirstOrDefault(contract => !contract.IsSacrifice) ?? ParContracts.FirstOrDefault();


    /// <summary>The highest contract there is, and the book of six tricks every contract is counted above.</summary>
    private const int MaxLevel = 7;
    private const int Book = 6;


    /// <summary>
    /// The whole table, cell by cell, worked out into the three things the panel shows.
    /// </summary>
    /// <remarks>
    /// Two of the three are simply the trick count said differently, but the third depends on what the auction bought, so
    /// the table cannot be read without being told. Passing no contract - a board passed out, or one being solved on its
    /// own - leaves that third answer empty and the other two unchanged.
    /// </remarks>
    /// <param name="declarer">The seat that declared, or null where there was no contract.</param>
    public IReadOnlyList<TableCell> Cells(PlayerPosition? declarer = null, int level = 0, BidColor color = BidColor.NoColor) {
        // Only the defenders can take a contract away, and only from somebody who bought one.
        var defenders = declarer?.GetPair().Opponents();

        return Table.Entries()
            .Select(entry => new TableCell(
                entry.Declarer,
                entry.Denomination,
                entry.Tricks,
                entry.Tricks > Book ? entry.Tricks - Book : null,
                entry.Declarer.GetPair() == defenders ? Down(entry, level, color) : null))
            .ToList();
    }


    /// <summary>
    /// How far this seat would be down, had it bid this denomination over the contract that won the auction.
    /// </summary>
    /// <remarks>
    /// At the cheapest level that would have done it, because the question being asked is what taking the contract away
    /// costs, and any higher level is a worse answer to it that the pair had no reason to choose.
    /// </remarks>
    private static int? Down(DoubleDummyEntry entry, int level, BidColor color) {
        var cheapest = Outranks(level, entry.Denomination, level, color) ? level : level + 1;
        return cheapest > MaxLevel ? null : Math.Max(0, cheapest + Book - entry.Tricks);
    }


    /// <summary>Whether the given pair is playing this board vulnerable.</summary>
    public bool IsVulnerable(Pair pair) =>
        Vulnerability == Vulnerability.Both || (Vulnerability == Vulnerability.NorthSouth ? pair == Pair.NorthSouth : Vulnerability == Vulnerability.EastWest && pair == Pair.EastWest);


    /// <summary>
    /// The least bad thing that can happen to this pair, which on a good board is the best thing.
    /// </summary>
    /// <remarks>
    /// Three outcomes, in the order a pair would consider them. It can make something, and takes the best of it - nothing
    /// else it could bid pays more. It can make nothing, but can buy the contract and go down cheaply enough to be worth
    /// it. Or it can do neither, and the least it can lose is what the opponents make against a defence that cannot
    /// improve on it.
    /// <para>
    /// Every board has an answer for both pairs: thirteen tricks cannot be split so that neither side takes seven of
    /// them in anything, so at least one pair always makes a contract and the other always has something to defend.
    /// </para>
    /// </remarks>
    public PairBest? Best(Pair pair) {
        var mine = BestMaking(pair);
        var theirs = BestMaking(pair.Opponents());

        // Nobody to outbid, so whatever we make is ours to play.
        if (theirs is null) {
            return mine;
        }

        /*
         * Ranking decides who gets to play, not who makes the most.
         *
         * A pair holding eight tricks in clubs "makes" two clubs, but it will never play there against opponents with a
         * slam: they simply bid it. A contract below the one the other side is going to buy is not an outcome, and
         * offering it as this pair's best is offering it a deal it was never going to get.
         */
        if (mine is not null && Outranks(mine.Level, mine.Color, theirs.Level, theirs.Color)) {
            return mine;
        }

        return CheapestSacrifice(pair, theirs) ?? Defend(pair, theirs);
    }


    /// <summary>
    /// Letting the opponents play: the pair concedes their contract and pays for it.
    /// </summary>
    /// <remarks>
    /// Scored on the contract rather than on the play - the opponents are credited with making exactly what they bid, and
    /// any overtricks are left out. A defender did not choose to be defending, and counting tricks it was never going to
    /// stop would make the number read like a punishment for the auction rather than a measure of the board.
    /// </remarks>
    private PairBest Defend(Pair pair, PairBest opponents) {
        var exactly = BridgeScoring.Made(opponents.Level, opponents.Color, 0, IsVulnerable(opponents.Pair));
        return new PairBest(pair, opponents.Declarer, opponents.Level, opponents.Color, opponents.Level + 6, -exactly, IsDefence: true);
    }


    /// <summary>
    /// What the auction cost this pair, and the one thing it could most usefully have done differently.
    /// </summary>
    /// <remarks>
    /// Every alternative considered is one the pair actually had. A side that bought the contract had the whole auction in
    /// its hands and could have stopped lower or pushed higher, so its own best always counts. A side that defended could
    /// only have bid over what was in front of it - a contract ranking below the one the opponents bought was never on
    /// offer - and could always have doubled, or not.
    /// <para>
    /// Where more than one was available the biggest is the one reported, because the smaller of two mistakes is not the
    /// one worth hearing about.
    /// </para>
    /// </remarks>
    /// <param name="declarer">The seat that declared, or null on a board that was passed out - where there is nothing to compare.</param>
    public BiddingDifference? Difference(Pair pair, PlayerPosition? declarer, int level, BidColor color, Doubling doubling) {
        if (declarer is null) {
            return null;
        }

        var declaring = declarer.Value.GetPair();
        var tricks = Table.Tricks(declarer.Value, color);
        var theirs = IsVulnerable(declaring);
        var played = BridgeScoring.Score(level, color, tricks, theirs, doubling);

        // The same board from the other side of the table: what one pair scores, the other concedes.
        var ours = declaring == pair ? played : -played;
        var went = tricks < level + 6;

        if (declaring == pair) {
            var mine = Best(pair);
            if (mine is null) {
                return null;
            }

            if (ours == mine.Score) {
                return null;
            }

            // Going down in a contract nobody made them buy is its own kind of miss, and worth naming as one.
            return new BiddingDifference(pair, ours - mine.Score, went ? BiddingMiss.Overbid : BiddingMiss.CouldHaveBid);
        }

        // Defending. What actually happened is itself one of the options, so that an auction with nothing wrong with it
        // comes out at zero rather than at whatever the first alternative happened to be worth.
        var options = new List<(int Score, BiddingMiss Reason)> { (ours, BiddingMiss.None) };

        var best = Best(pair);
        if (best is not null && !best.IsDefence && Outranks(best.Level, best.Color, level, color)) {
            options.Add((best.Score, BiddingMiss.CouldHaveBid));
        }

        if (doubling == Doubling.None && went) {
            options.Add((-BridgeScoring.Score(level, color, tricks, theirs, Doubling.Doubled), BiddingMiss.CouldHaveDoubled));
        }

        if (doubling != Doubling.None && !went) {
            options.Add((-BridgeScoring.Score(level, color, tricks, theirs, Doubling.None), BiddingMiss.ShouldNotHaveDoubled));
        }

        // Nothing was on offer, so there is nothing to say. A pair is not told it misbid a contract it could not reach.
        if (options.Count == 1) {
            return null;
        }

        var better = options.MaxBy(option => option.Score);
        return better.Reason == BiddingMiss.None ? null : new BiddingDifference(pair, ours - better.Score, better.Reason);
    }


    /// <summary>The highest scoring contract the pair actually makes, or null when it makes none at all.</summary>
    private PairBest? BestMaking(Pair pair) {
        PairBest? best = null;

        foreach (var denomination in DoubleDummyTable.Denominations) {
            var level = Table.MakeableLevel(pair, denomination);
            if (level < 1) {
                continue;
            }

            var tricks = Table.Tricks(pair, denomination);
            var candidate = new PairBest(
                pair,
                Table.BetterSeat(pair, denomination),
                level,
                denomination,
                tricks,
                BridgeScoring.Score(level, denomination, tricks, IsVulnerable(pair)));

            if (Improves(candidate, best)) {
                best = candidate;
            }
        }

        return best;
    }


    /// <summary>
    /// The cheapest contract this pair can buy over the opponents', assuming it gets doubled for it. Null when every
    /// sacrifice costs more than simply defending does.
    /// </summary>
    private PairBest? CheapestSacrifice(Pair pair, PairBest opponents) {
        PairBest? best = null;

        for (var level = opponents.Level; level <= MaxLevel; level++) {
            foreach (var denomination in DoubleDummyTable.Denominations) {
                if (!Outranks(level, denomination, opponents.Level, opponents.Color)) {
                    continue;
                }

                var tricks = Table.Tricks(pair, denomination);
                var candidate = new PairBest(
                    pair,
                    Table.BetterSeat(pair, denomination),
                    level,
                    denomination,
                    tricks,
                    BridgeScoring.Score(level, denomination, tricks, IsVulnerable(pair), Doubling.Doubled));

                // Defending costs this pair whatever the opponents make. A sacrifice has to beat that to be worth bidding.
                if (candidate.Score > -opponents.Score && Improves(candidate, best)) {
                    best = candidate;
                }
            }
        }

        return best;
    }


    /// <summary>Auction order: a higher level, or the same level in a higher ranking denomination.</summary>
    private static bool Outranks(int level, BidColor denomination, int overLevel, BidColor overDenomination) {
        if (level != overLevel) {
            return level > overLevel;
        }

        return Array.IndexOf(DoubleDummyTable.Denominations, denomination) > Array.IndexOf(DoubleDummyTable.Denominations, overDenomination);
    }


    /// <summary>More points wins. On a tie the cheaper contract does: it is the one with a trick in hand.</summary>
    private static bool Improves(PairBest candidate, PairBest? best) {
        if (best is null) {
            return true;
        }

        return candidate.Score != best.Score ? candidate.Score > best.Score : candidate.Level < best.Level;
    }
}
