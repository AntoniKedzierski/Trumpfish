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


    /// <summary>
    /// Wiąże przejścia: każdemu węzłowi z <see cref="BidNode.ContinuationNodeId"/> podstawia odzywkę o tym identyfikatorze.
    /// </summary>
    /// <remarks>
    /// Robione po wczytaniu, tak samo jak <see cref="AssignParent"/> - z tego samego powodu: przejście wskazuje w bok
    /// drzewa, więc w serializacji jest samym identyfikatorem, a obiektem staje się dopiero tutaj. Wskazanie w próżnię
    /// (cel został skasowany) zostawia <c>null</c> i nie jest błędem - identyfikator zostaje, żeby dało się go zobaczyć
    /// i poprawić w edytorze.
    /// </remarks>
    public void AssignContinuations() {
        var byNodeId = AllNodes().GroupBy(node => node.NodeId).ToDictionary(group => group.Key, group => group.First());

        foreach (var node in AllNodes()) {
            node.Continuation = node.ContinuationNodeId is Guid target && byNodeId.TryGetValue(target, out var found) ? found : null;
        }
    }


    /// <summary>Każda odzywka systemu, ze wszystkich korzeni i z każdej głębokości.</summary>
    public IEnumerable<BidNode> AllNodes() {
        foreach (var root in Roots) {
            foreach (var node in root.Bids.SelectMany(Descend)) {
                yield return node;
            }
        }
    }


    private static IEnumerable<BidNode> Descend(BidNode node) {
        yield return node;

        foreach (var descendant in node.NextBids.SelectMany(Descend)) {
            yield return descendant;
        }
    }


    public List<BidNode> GetDescendants(List<InterruptedBid> bidSequence) {
        var children = Openings()!.Bids.Concat(Defences()!.Bids).ToList();

        for (int i = 0; i < bidSequence.Count - 1; ++i) {
            // Odzwyki pasujące na tym poziomie.
            var matchingBids = GetMatchingBids(children, bidSequence[i]);

            // Bierzemy ich dzieci.
            children = GetChildren(matchingBids);
        }

        // Logika analogiczna do GetMatchingChildren.
        var lastBid = bidSequence.Last();
        return GetMatchingBids(children, lastBid);
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


    public List<BidNode> GetMatchingBids(List<BidNode> bidCollection, InterruptedBid lookup) {
        var matchingBids = bidCollection
            .Where(e => e.Equals(lookup))
            .Where(e => !e.IsDisabled);

        // Wyjęcie pasujących odzywek względem wcięcia.
        if (lookup.Interruption == null) {
            matchingBids = matchingBids.Where(e => e.Interjection == null);
        }
        else {
            var interjectedBids = matchingBids
                .Where(e => e.Interjection?.Equals(lookup.Interruption) ?? false)
                .ToList();

            matchingBids = interjectedBids.Count > 0
                ? interjectedBids
                : matchingBids.Where(e => e.Interjection == null);
        }

        // Zmaterializowanie listy pasujących odzywek.
        return matchingBids.ToList();
    }


    public List<BidNode> GetChildren(List<BidNode> parentNodes) => parentNodes
        .SelectMany(e => e.GetNextBids())
        .ToList();


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
