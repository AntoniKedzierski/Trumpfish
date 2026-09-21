using Model.Bidding.AI.Eval;
using Model.Bidding.Bids;
using Model.Enums;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Model.Bidding.AI.Engine;

public static class SystemBranchHelper {

    public static BidNode? GetNextBid(this IEnumerable<SystemBranch> branches) {
        if (!branches.Any()) {
            return null;
        }

        var confusingBids = branches
            .SelectMany(e => e.Head.GetNextBids())
            .Select(e => (Bid)e)
            .ToHashSet(new BidComparer());

        var candidates = branches
            .Select(e => e.GetNextBid(confusingBids))
            .Where(e => e != null)
            .Select(e => e!)
            .ToList();

        if (candidates.Count == 0) {
            return null;
        }

        // Preferowanie odzywek z systemu.
        if (candidates.Any(e => e.SystemResponse)) {
            var systemCandidates = candidates.Where(e => e.SystemResponse).ToList();
            var firstChosenBid = systemCandidates[0].BidNode;
            if (systemCandidates.Count <= 1 || !systemCandidates.Any(e => !e.BidNode.EqualsByColorAndValue(firstChosenBid))) {
                return firstChosenBid;
            }

            throw new Exception(
                "Multiple tree branches possible: " +
                string.Join("\n\r",
                    systemCandidates.Select(e => e.ToString() + ": " + e.BidNode.Condition)
                )
            );
        }

        var result = candidates
            .OrderByDescending(e => e.Score)
            .FirstOrDefault();

        if (result == null) {
            return null;
        }

        result.BidNode.Explanation += $" (score: {result.Score})";
        return result.BidNode;
    }


    public static SystemBranchResponse? ToSystemResponse(this BidNode? bidNode) {
        if (bidNode == null) {
            return null;
        }

        return new SystemBranchResponse(bidNode, true, 1.0);
    }


    public static SystemBranchResponse? ToNaturalResponse(this BidNode? bidNode, HandEvaluation combinedHand, HashSet<Bid>? confusingBids = null) {
        if (bidNode == null) {
            return null;
        }

        if (confusingBids?.Contains(bidNode) ?? false) {
            return new SystemBranchResponse(
                BidNode.Pass("Odzywka naturalna anulowana, gdyż myliła się z systemem."), 
                false, 
                0.0
            );
        }

        return new SystemBranchResponse(bidNode, false, combinedHand.GetContractScore(bidNode.Color));
    }

}
