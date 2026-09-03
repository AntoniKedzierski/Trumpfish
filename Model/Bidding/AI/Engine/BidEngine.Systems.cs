using Model.Bidding.Bids;

namespace Model.Bidding.AI.Engine;

public partial class BidEngine {

    private BidNode? GetBidFromSystemBranches(Hand hand, List<BidNode> branches, Bid? lastOpponentsBid = null) {
        if (branches.Count == 0) {
            return null;
        }

        var chosenBids = new List<BidNode>();
        var depth = branches.First().GetDepth();

        foreach (var branchHead in branches) {
            // Wyklucz gałęzie, które nie pasują skacząc po dziadkach, aż do korzenia.
            if (depth > 0) {
                var lastOwnBidCandidate = branchHead.Parent;
                var invalidPath = false;

                while (lastOwnBidCandidate != null) {
                    if (!lastOwnBidCandidate.Matches(hand)) {
                        invalidPath = true;
                        break;
                    }
                    lastOwnBidCandidate = lastOwnBidCandidate.GetGrandparent();
                }

                if (invalidPath) {
                    continue;
                }
            }

            // Weź wszystko, co pasuje do ręki i jest legalne, i wybierz z tego systemową odzywkę.
            var bidCandidates = FindMatchingBids(hand, branchHead);
            var chosenBid = ChooseBidFromSystem(bidCandidates, lastOpponentsBid);

            if (chosenBid != null) {
                chosenBids.Add(chosenBid);
            }
        }

        if (chosenBids.Count == 0) {
            return null;
        }

        var firstChosenBid = chosenBids[0];
        if (!chosenBids.All(e => e.EqualsByColorAndValue(firstChosenBid))) {
            throw new Exception("Multiple tree branches possible: " + string.Join(", ", chosenBids.Distinct()));
        }

        return firstChosenBid;
    }


    public List<BidNode> FindMatchingBids(Hand hand, BidNode head) => [.. head
        .NextBids
        .Where(e => !e.IsDisabled)
        .Where(e => e.IsBidLegal(Auction))
        .Where(e => e.Matches(hand))];


    public List<BidNode> FindNodesByHand(Hand hand, Root root) => [.. root
        .Bids
        .Where(e => !e.IsDisabled)
        .Where(e => e.IsBidLegal(Auction))
        .Where(e => e.Matches(hand))];


    public static BidNode? ChooseBidFromSystem(List<BidNode> legalBids, Bid? lastOpponentsBid = null, bool preferConventions = false) {
        if (legalBids.Count == 0) {
            return null;
        }

        // Jeżeli przeciwnicy się nie wtrącili, to wywalamy wszystkie odzywki po wtrąceniach.
        var bidsToChooseFrom = lastOpponentsBid == null
            ? legalBids.Where(e => e.Interjection == null).ToList()
            : legalBids.Where(e => e.Interjection == null || e.Interjection.Equals(lastOpponentsBid)).ToList();

        if (bidsToChooseFrom.Count == 0) {
            return null;
        }

        // Najpierw preferowane odzwyki, potem najmniejsza.
        var lowestBid = bidsToChooseFrom
            .OrderByDescending(e => e.IsPreferred ? 1 : 0)
            .ThenByDescending(e => preferConventions ? (e.Convention != null ? 1 : 0) : 0) 
            .ThenBy(e => e)
            .First();

        lowestBid.IsFromSystem = true;
        return lowestBid;
    }
}
