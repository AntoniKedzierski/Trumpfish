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
        var children = Openings()!.Bids.Concat(Defences()!.Bids).ToList();

        for (int i = 0; i < bidSequence.Count - 1; ++i) {
            children = [.. GetMatchingChildren(children, bidSequence[i])];
        }

        // Logika analogiczna do GetMatchingChildren.
        var lastBid = bidSequence.Last();
        var candidates = children.Where(e => e.Equals(lastBid) && !e.IsDisabled);

        // Brak wcięcia, zwracamy tylko odzywki bez przypisanego wcięcia.
        if (lastBid.Interruption == null) {
            return candidates.Where(e => e.Interjection == null).ToList();
        }

        // Nastąpiło wcięcie.
        // Jeżeli wśród kandydatów są jakiekowliek wcięcia, to zwracamy tylko je.
        if (candidates.Any(e => e.Interjection != null)) {
            return candidates.Where(e => e.Interjection != null && e.Interjection.Equals(lastBid.Interruption)).ToList();
        }

        // Jeżeli nie, to wszystko.
        return candidates.ToList();
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
        var candidates = parentNodes
            .Where(e => e.Equals(nextBid))
            .Where(e => !e.IsDisabled);

        // Brak wcięcia, zwracamy tylko odzywki bez przypisanego wcięcia.
        if (nextBid.Interruption == null) {
            return candidates
                .Where(e => e.Interjection == null)
                .SelectMany(e => e.NextBids)
                .ToList();
        }

        // Nastąpiło wcięcie.
        // Jeżeli wśród kandydatów są jakiekowliek wcięcia, to zwracamy tylko je.
        if (candidates.Any(e => e.Interjection != null)) {
            return candidates
                .Where(e => e.Interjection != null && e.Interjection.Equals(nextBid.Interruption))
                .SelectMany(e => e.NextBids)
                .ToList();
        }

        // Jeżeli nie, to wszystko.
        return candidates
            .SelectMany(e => e.NextBids)
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
