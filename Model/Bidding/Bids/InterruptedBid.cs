using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Model.Bidding.Bids;

public class InterruptedBid : Bid {

    public Bid? Interruption { get; set; }

    public InterruptedBid(Bid bid) {
        Type = bid.Type;
        Color = bid.Color;
        Value = bid.Value;
        IsFromSystem = bid.IsFromSystem;
        Explanation = bid.Explanation;
    }

}
