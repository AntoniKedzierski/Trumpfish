using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Model.Bidding.Bids;

public class InterruptedBid : Bid {

    /// <summary>Bid made by the preceding opponent, so sequences with interjections can be described. Only <see cref="BidType.Submit"/> or <see cref="BidType.Double"/> make sense here.</summary>
    public Bid? Interjection { get; set; }

    public InterruptedBid() : base() { }

    public InterruptedBid(Bid bid) {
        Type = bid.Type;
        Color = bid.Color;
        Value = bid.Value;
        IsFromSystem = bid.IsFromSystem;
        Explanation = bid.Explanation;
    }


    public bool ValueEquals(InterruptedBid other) {
        if (Interjection == null && other.Interjection == null) {
            return base.Equals(other);
        }

        return (Interjection?.Equals(other.Interjection) ?? false) && base.Equals(other);
    }

}
