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


    public List<BidNode> GetDescendants(List<Bid> bidSequence) {
        var children = Openings()!.Bids;

        for (int i = 0; i < bidSequence.Count - 1; ++i) {
            children = GetMatchingChildren(children, bidSequence[i]).ToList();
        }

        return [.. children
            .Where(e => e.Equals(bidSequence[bidSequence.Count - 1]))
            .Distinct()];
    }


    public List<BidNode> GetSystemLeaves(List<Bid> bidSequence) {
        var children = Openings()!.Bids;

        for (int i = 0; i < bidSequence.Count; ++i) {
            var nextChildren = GetMatchingChildren(children, bidSequence[i]).ToList();

            // Skończył się system, wszystkie pozostałe odzywki są naturalne (nie dają informacji).
            if (nextChildren.Count == 0) {
                return children.Where(e => e.Matches(bidSequence[i])).ToList();
            }

            children = nextChildren;
        }

        return children;
    }


    public IEnumerable<BidNode> GetDescendants(BidNode parent, Bid bid) {
        foreach (var child in parent.NextBids) {
            if (child.Matches(bid)) {
                yield return child;
            }
        }
    }


    public List<BidNode> GetMatchingChildren(List<BidNode> parentNodes, Bid nextBid) {
        return parentNodes
            .Where(e => e.Equals(nextBid))
            .SelectMany(e => e.NextBids)
            .ToList();
    }


    public IEnumerable<BidNode> GetOpenings(Bid bid) {
        var bids = Openings()?.Bids ?? [];
        foreach (var child in bids) {
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
