namespace Model.Bidding.Bids;

public class Root {

    public string? Name { get; set; }

    public List<BidNode> Bids { get; set; } = [];


    public void AssignParent() {
        foreach (var bid in Bids) {
            bid.AssignParent(null);
        }
    }


    /// <summary>
    /// Zwraca wszystkie końcowe odzywki na pasującej ścieżce.
    /// </summary>
    /// <param name="path"></param>
    /// <returns></returns>
    public List<BidNode> GetNodesOnPath(List<BidNode> path) {
        var children = Bids;
        for (int i = 0; i < path.Count; ++i) {
            children = children.Where(e => e.Matches(path[i])).SelectMany(e => e.NextBids).ToList();
        }
        return children;
    }
}
