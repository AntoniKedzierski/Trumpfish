using Model.Bidding.AI.Engine;
using Model.Bidding.Bids;
using Model.Enums;

namespace Model;

public class Player {

    public PlayerPosition CurrentPosition { get; private set; }

    public int Score { get; private set; }

    public string Name { get; private set; }

    public Hand Hand { get; private set; }

    public BidEngine Engine { get; private set; }


    public Player(string name, PlayerPosition startingPosition, BidEngine engine) {
        Name = name;
        CurrentPosition = startingPosition;
        Engine = engine;
    }


    public void GiveHand(Hand hand) {
        Hand = hand;
    }


    public virtual Bid MakeBid() {
        return Engine.Get();
    }

}
