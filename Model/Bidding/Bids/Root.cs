namespace Model.Bidding.Bids;

public class Root {

    public string? Name { get; set; }

    public List<BidNode> Bids { get; set; } = [];


    public void AssignParent() {
        foreach (var bid in Bids) {
            bid.AssignParent(null);
        }
    }
}
