using Model.Bidding.Bids;
using Newtonsoft.Json;

namespace Model.Bidding.AI;

public class BiddingSystem {

    public const string OpeningsRootName = "Otwarcia";
    public const string DefencesRootName = "Obrona";

    public string SystemName { get; set; } = "";

    public List<Root> Roots { get; set; } = [];

    [JsonConstructor]
    public BiddingSystem() {
    }

    public BiddingSystem(string filePath) {
        LoadSystem(filePath);
        AssignParent();
    }

    public void LoadSystem(string filePath) {
        using var file = File.OpenText(filePath);
        using var reader = new JsonTextReader(file);

        var loadedSystem = new JsonSerializer().Deserialize<BiddingSystem>(reader)!;

        SystemName = loadedSystem.SystemName;
        Roots = loadedSystem.Roots;
    }


    public void AssignParent() {
        foreach (var root in Roots) {
            root.AssignParent();
        }
    }


    public List<BidNode> GetDescendants(List<InterruptedBid> bidSequence) {
        var children = Openings()!.Bids;

        for (int i = 0; i < bidSequence.Count - 1; ++i) {
            children = [.. GetMatchingChildren(children, bidSequence[i])];
        }

        var lastBid = bidSequence.Last();
        if (lastBid.Interruption != null) {
            return children
                .Where(e => e.Equals(lastBid) && !e.IsDisabled)
                .Where(e => e.Interjection != null && e.Interjection.Equals(lastBid.Interruption))
                .ToList();
        }
        else {
            return children
                .Where(e => e.Equals(lastBid) && !e.IsDisabled && e.Interjection == null)
                .Distinct()
                .ToList();
        }
    }


    public IEnumerable<BidNode> GetDescendants(BidNode parent, Bid bid) {
        foreach (var child in parent.NextBids) {
            if (child.IsDisabled) {
                continue;
            }

            if (child.Matches(bid)) {
                yield return child;
            }
        }
    }


    public IEnumerable<BidNode> GetDescendants(Root root, Bid bid) {
        foreach (var child in root.Bids) {
            if (child.IsDisabled) {
                continue;
            }

            if (child.Matches(bid)) {
                yield return child;
            }
        }
    }


    public List<BidNode> GetMatchingChildren(List<BidNode> parentNodes, InterruptedBid nextBid) {
        if (nextBid.Interruption == null) {
            return parentNodes
                .Where(e => e.Equals(nextBid) && e.Interjection == null)
                .SelectMany(e => e.NextBids)
                .Where(e => !e.IsDisabled)
                .ToList();
        }

        return parentNodes
            .Where(e => e.Equals(nextBid) && e.Interjection != null && e.Interjection.Equals(nextBid.Interruption))
            .SelectMany(e => e.NextBids)
            .Where(e => !e.IsDisabled)
            .ToList();
    }


    public List<BidNode> GetMatchingChildren(List<BidNode> parentNodes, Bid nextBid) {
        return parentNodes
            .Where(e => e.Equals(nextBid))
            .SelectMany(e => e.NextBids)
            .Where(e => !e.IsDisabled)
            .ToList();
    }


    public IEnumerable<BidNode> GetOpenings(Bid bid) {
        var bids = Openings()?.Bids ?? [];
        foreach (var child in bids) {
            if (child.IsDisabled) {
                continue;
            }

            if (child.Matches(bid)) {
                yield return child;
            }
        }
    }


    public Root Openings() {
        return Roots.FirstOrDefault(e => e.Name == OpeningsRootName) ?? throw new Exception("Nie znaleziono otwarć.");
    }


    public Root? Defences() {
        return Roots.FirstOrDefault(e => e.Name == DefencesRootName);
    }
}
