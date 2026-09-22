using Model.Enums;
using Model.Helpers;
using Newtonsoft.Json;
using System.Diagnostics;
using System.Diagnostics.CodeAnalysis;

namespace Model.Bidding.Bids;

public class Bid : IEquatable<Bid>, IEqualityComparer<Bid>, IComparable<Bid> {

    public BidType Type { get; set; }

    public BidColor Color { get; set; }

    public int? Value { get; set; }

    public bool IsFromSystem { get; set; } = false;

    public string? Explanation { get; set; }


    public Bid() { }


    public Bid(string explanation) {
        Explanation = explanation;
    }


    public bool MakesGame() {
        if (Type != BidType.Submit) {
            return false;
        }

        return Color == BidColor.NoTrump && Value >= 3
            || Color == BidColor.Spades && Value >= 4
            || Color == BidColor.Hearts && Value >= 4
            || Color == BidColor.Diamonds && Value >= 5
            || Color == BidColor.Clubs && Value >= 5;
    }


    public bool AtLevel(int level) {
        return Type == BidType.Submit && Value >= level;
    }


    public int GetLevel() {
        return Value!.Value;
    }


    public bool IsBidLegal(Auction auction) {
        if (Type == BidType.Pass) {
            return true;
        }

        if (Value > 7) {
            return false;
        }

        Bid? lastBid = auction.GetLastSubmittedBid();

        if (lastBid == null) {
            return true;    //if there are no previous bids, any bid is legal
        }

        if ((lastBid.Type == BidType.Pass || lastBid.Type == BidType.Submit) && Type == BidType.Double) {
            return true;
        }

        if ((lastBid.Type == BidType.Pass || lastBid.Type == BidType.Double) && Type == BidType.Redouble) {
            return true;
        }

        var lastSubmitBid = auction.GetLastSubmittedBid(true)!;
        if (Value > lastSubmitBid.Value) {
            return true;
        }

        if (Value == lastSubmitBid.Value && (int)Color > (int)lastBid.Color) {
            return true;
        }

        return false;
    }


    public override string ToString() {
        if (Type == BidType.Pass) {
            return "Pass";
        }

        if (Type == BidType.Double) {
            return "X";
        }

        if (Type == BidType.Redouble) {
            return "XX";
        }

        return $"{Value}{Color.ColorMark()}";
    }


    public bool Equals(int value, BidColor color) {
        return Color == color && Value == value && Type == BidType.Submit;
    }


    public virtual bool Equals(Bid? other) {
        if (other == null) {
            return false;
        }

        return other.Color == Color && other.Type == Type && (other.Value?.Equals(Value) ?? true);
    }


    public int GetBidCode() {
        return (Value ?? 0) * 10000 + (int)Type * 1000 + (int)Color * 100;
    }


    public static Bid Pass(string? explanation = null) {
        return new Bid { Type = BidType.Pass, Explanation = explanation };
    }


    public bool Equals(Bid? x, Bid? y) {
        return x?.Equals(y) ?? true;
    }


    public int GetHashCode([DisallowNull] Bid obj) {
        return obj.GetBidCode();
    }



    public int CompareTo(Bid? other) {
        if (other == null) {
            return 1;
        }

        // Najpierw porównujemy Value (poziom odzywki: 1-7)
        int valueComparison = Nullable.Compare(Value, other.Value);
        if (valueComparison != 0) {
            return valueComparison;
        }

        // Jeśli Value są równe, porównujemy Color
        // Porządek: ♣ < ♦ < ♥ < ♠ < NoTrump
        return GetColorOrder(Color).CompareTo(GetColorOrder(other.Color));
    }


    private static int GetColorOrder(BidColor color) {
        return color switch {
            BidColor.Clubs => 0,
            BidColor.Diamonds => 1,
            BidColor.Hearts => 2,
            BidColor.Spades => 3,
            _ => 4 // NoColor/NoTrump
        };
    }
}

