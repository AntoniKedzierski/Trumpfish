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

    public static List<SystemBranch> GetNextBid(this IEnumerable<SystemBranch> branches, out Bid? nextBid) {
        nextBid = null;
        if (!branches.Any()) {
            return [];
        }

        // Wspólne dla wszystkich gałęzi.
        var confusingBids = branches.GetConfusingBids();
        var newBranches = new List<SystemBranch>(branches.Count());
        var candidates = new Dictionary<Bid, bool>();

        // Każda gałąź robi swojego NextBida i przedłuża samą siebie.
        foreach (var branch in branches) {
            var branchContinuation = branch.MakeNextBid(confusingBids);
            if (branchContinuation != null) {
                candidates.Add(branchContinuation.Result, branchContinuation.OnlySystem);
                newBranches.Add(branchContinuation);
            }
        }

        // Brak dalszych odzywek, wychodzimy.
        if (newBranches.Count == 0) {
            return [];
        }

        // Jeżeli wszystkie gałęzie są z systemu:
        if (newBranches.All(e => e.OnlySystem)) {
            var systemCandidates = newBranches
                .Select(e => e.Head)
                .ToList();

            var message = string.Join("\n\r", systemCandidates.Select(e => e.ToString() + ": " + e.Condition));

            // Sprawdzenie, czy system daje jednoznaczną odpowiedź.
            if (systemCandidates.Any(e => !e.EqualsByColorAndValue(systemCandidates[0]))) {
                throw new Exception("Multiple tree branches possible: " + message);
            }

            nextBid = systemCandidates[0];
            nextBid.Explanation = systemCandidates[0].Condition;
            return newBranches;
        }
        // Wszystkie gałęzie przedłużone (naturalne).
        else if (newBranches.All(e => !e.OnlySystem)) {
            // Zwracamy najniższą mozliwą.
            nextBid = newBranches
                .Select(e => e.Result)
                .OrderBy(e => e)
                .First();

            return newBranches;
        }

        var invalidBids = string.Join('·', candidates.Select(e => e.Value ? e.Key.ToString() : $"({e.Key})"));
        throw new Exception("Some branches are system, some are natural: " + invalidBids);
    }


    public static List<InterruptedBid> GetCommonBidSequence(this IEnumerable<SystemBranch> branches) {
        var paths = branches
            .Select(e => e.Head
                .GetPath()
                .Cast<InterruptedBid>()
                .ToList()
            ).ToArray();

        if (paths.Length == 0) {
            return [];
        }

        var firstPath = paths[0];
        var pathLength = firstPath.Count;
        for (int i = 1; i < paths.Length; ++i) {
            if (paths[i].Count != pathLength) {
                throw new Exception("Invalid path length.");
            }

            // Sprawdzenie, czy odzywki na ścieżkach są identyczne.
            for (int j = 0; j < pathLength; ++j) {
                // To sprawdza również wtrącenie!
                if (!firstPath[j].ValueEquals(paths[i][j])) {
                    throw new Exception($"Paths: {firstPath} and {paths[i]} are different at {j + 1} position.");
                }
            }
        }

        return firstPath;
    }


    public static HashSet<InterruptedBid> GetConfusingBids(this IEnumerable<SystemBranch> branches) {
        if (!branches.Any()) {
            return [];
        }

        var commonBidSequence = branches.GetCommonBidSequence();
        var biddingSystem = branches.First().BiddingSystem;
        var auction = branches.First().Auction;

        return biddingSystem
            .GetNextBids(commonBidSequence)
            .Where(e => e.IsBidLegal(auction))
            .Cast<InterruptedBid>()
            .ToHashSet(new BidComparer());
    }


    public static SystemBranchResponse? ToSystemResponse(this BidNode? bidNode) {
        if (bidNode == null) {
            return null;
        }

        return new SystemBranchResponse(bidNode, true, 1.0);
    }


    public static SystemBranchResponse? ToNaturalResponse(this BidNode? bidNode, HandEvaluation combinedHand, HashSet<InterruptedBid>? confusingBids = null) {
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
