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


    public IEnumerable<BidNode> GetDescendants(BidNode parent, Bid bid) {
        foreach (var child in parent.NextBids) {
            if (child.Matches(bid)) {
                yield return child;
            }
        }
    }


    public IEnumerable<BidNode> GetOpenings(Bid bid) {
        var bids = Openings()?.Bids ?? [];
        foreach (var child in bids) {
            if (child.Matches(bid)) {
                yield return child;
            }
        }
    }


    public Root? Openings() {
        return Roots.FirstOrDefault(e => e.Name == OpeningsRootName);
    }


    public Root? Defences() {
        return Roots.FirstOrDefault(e => e.Name == DefencesRootName);
    }
}
