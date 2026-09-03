using Model.Bidding.AI.Engine;
using Model.Enums;
using Model.Helpers;
using Newtonsoft.Json;
using System.Diagnostics.CodeAnalysis;
using System.Text;

namespace Model.Bidding.Bids;

public class BidNode : Bid, IEquatable<BidNode>, IEqualityComparer<BidNode>, IComparable<BidNode> {

    /// <summary>Stable identity of the node, serialized so clients can address one exact bid even when several share the same path.</summary>
    public Guid NodeId { get; set; } = Guid.NewGuid();

    public string? Description { get; set; }

    public string? Condition { get; set; }

    public string? Convention { get; set; }

    public NumberRange? PointsRange { get; set; }

    public NumberRange? SpadesCardRange { get; set; }

    public NumberRange? HeartsCardRange { get; set; }

    public NumberRange? DiamondsCardRange { get; set; }
    public NumberRange? ClubsCardRange { get; set; }
    public decimal? SpadesStops { get; set; }

    public decimal? HeartsStops { get; set; }

    public decimal? DiamondsStops { get; set; }

    public decimal? ClubsStops { get; set; }

    public string? ColorDistribution { get; set; }

    public int? Aces { get; set; }

    public int? Kings { get; set; }

    public bool OpenerBid { get; set; }

    public bool SignOff { get; set; }

    public bool OneRoundForcing { get; set; }

    public bool GameForcing { get; set; }

    public bool AutomaticResponse { get; set; }

    public bool GoToOpenings { get; set; }

    public bool IsPreferred { get; set; }

    /// <summary>
    /// Takes this bid, and with it everything below it, out of the simulation without deleting it. Children are not marked in
    /// turn: a branch is reached through its parent, so switching the parent off is enough to switch the whole branch off.
    /// </summary>
    public bool IsDisabled { get; set; }

    /// <summary>Bid made by the preceding opponent, so sequences with interjections can be described. Only <see cref="BidType.Submit"/> or <see cref="BidType.Double"/> make sense here.</summary>
    public Bid? Interjection { get; set; }

    public List<BidNode> NextBids { get; set; } = [];

    /// <summary>Back-reference assigned after deserialization. Never serialized, otherwise the tree becomes cyclic.</summary>
    [JsonIgnore, TextJsonIgnore]
    public BidNode? Parent { get; set; }

    public BiddingGoal RealizedGoal { get; set; }

    public string? AiSource { get; set; }

    [JsonIgnore, TextJsonIgnore]
    public string Path { get; set; } = "";

    public BidNode() : base() { }


    public int GetDepth() {
        var parent = Parent;
        var i = 0;

        while (parent != null) {
            i++;
            parent = parent.Parent;
        }

        return i;
    }


    public BidNode? GetGrandparent() => Parent?.Parent;


    public BidNode GetRoot() {
        if (Parent == null) {
            return this;
        }

        return Parent.GetRoot();
    }


    public List<BidNode> GetPath() {
        if (Parent == null) {
            return [this];
        }

        return [.. Parent.GetPath(), this];
    }


    public bool Matches(Hand hand) {
        return hand.Matches(PointsRange, SpadesCardRange, HeartsCardRange, DiamondsCardRange, ClubsCardRange, Aces, Kings);
    }


    public bool Matches(Bid bid) => Type == bid.Type && Color == bid.Color && Value == bid.Value;


    public static BidNode Submit(int value, BidColor color, string explanation) => new() {
        Type = BidType.Submit,
        Value = value,
        Color = color,
        Explanation = explanation,
        IsFromSystem = false
    };


    public static BidNode SubmitOrPass(Auction auction, int value, BidColor color, string explanation) {
        var lowestValue = auction.GetLowestLegalValue(color);
        if (value > lowestValue) {
            return Pass($"Chęć zgłoszenia {value}{color}, zamieniła się w PASS, gdyż najniższa dostępna wartość to {lowestValue}{color}.");
        }
        return Submit(value, color, explanation);
    }


    public static BidNode SubmitLowest(Auction auction, BidColor color, int limit, string explanation) {
        var lowestValue = auction.GetLowestLegalValue(color);
        if (lowestValue > limit) {
            return Pass($"Nie można zgłosić {lowestValue}{color}, gdyż limit wynosił {limit}{color}.");
        }
        return Submit(lowestValue, color, explanation);
    }


    public static BidNode SubmitLowest(Auction auction, BidColor color, string explanation) {
        var lowestValue = auction.GetLowestLegalValue(color);
        return Submit(lowestValue, color, explanation);
    }


    public static BidNode SubmitWithRaise(Auction auction, BidColor color, string explanation) {
        var lowestValue = auction.GetLowestLegalValue(color);
        return Submit(lowestValue + 1, color, "Podniesienie. " + explanation);
    }


    public static BidNode Submit(int value, CardColor color, string explanation) => Submit(value, color.ToBidColor(), explanation);


    public static BidNode SubmitGame(BidColor color, string explanation) => color switch {
        BidColor.NoTrump => Submit(3, BidColor.NoTrump, "Zgłoszenie gry. " + explanation),
        BidColor.Spades => Submit(4, BidColor.Spades, "Zgłoszenie gry. " + explanation),
        BidColor.Hearts => Submit(4, BidColor.Hearts, "Zgłoszenie gry. " + explanation),
        BidColor.Diamonds => Submit(5, BidColor.Diamonds, "Zgłoszenie gry. " + explanation),
        BidColor.Clubs => Submit(5, BidColor.Clubs, "Zgłoszenie gry. " + explanation),
        _ => throw new Exception("Invalid color.")
    };


    public static BidNode SubmitLowestLegalGameOrDouble(Auction auction, BidColor color, string explanation) {
        var lowestValue = auction.GetLowestLegalValue(color);

        // Póki co brak kontry.

        return color switch {
            BidColor.NoTrump => Submit(Math.Max(3, lowestValue), BidColor.NoTrump, explanation),
            BidColor.Spades => Submit(Math.Max(4, lowestValue), BidColor.Spades, explanation),
            BidColor.Hearts => Submit(Math.Max(4, lowestValue), BidColor.Hearts, explanation),
            BidColor.Diamonds => Submit(Math.Max(5, lowestValue), BidColor.Diamonds, explanation),
            BidColor.Clubs => Submit(Math.Max(5, lowestValue), BidColor.Clubs, explanation),
            _ => throw new Exception("Invalid color.")
        };
    }


    public static new BidNode Pass(string explanation) => new() {
        Type = BidType.Pass,
        Value = null,
        Color = BidColor.NoColor,
        Explanation = explanation,
        IsFromSystem = false
    };


    public static BidNode Double(string explanation) => new() {
        Type = BidType.Double,
        Value = null,
        Color = BidColor.NoColor,
        Explanation = explanation,
        IsFromSystem = false
    };


    public static BidNode Redouble(string explanation) => new() {
        Type = BidType.Redouble,
        Value = null,
        Color = BidColor.NoColor,
        Explanation = explanation,
        IsFromSystem = false
    };


    public Bid ToBid() {
        // Odzwyki spoza systemu mają swoje wyjaśnienie.
        if (!IsFromSystem) {
            return new("Spoza systemu. " + Explanation) {
                Type = Type,
                Color = Color,
                Value = Value,
                IsFromSystem = IsFromSystem
            };
        }

        return new(Condition ?? "Brak warunku dla systemowej odzywki.") {
            Type = Type,
            Color = Color,
            Value = Value,
            IsFromSystem = IsFromSystem
        };
    }


    public void AssignParent(BidNode? parent) {
        Parent = parent;
        foreach (var child in NextBids) {
            child.AssignParent(this);
        }
    }


    public bool Equals(BidNode? other) {
        if (other == null) {
            return false;
        }

        return NodeId.Equals(other.NodeId);
    }


    public bool EqualsByColorAndValue(Bid? other) {
        if (other == null) {
            return false;
        }

        if (Type == BidType.Pass && other.Type == Type) {
            return true;
        }

        return Color == other.Color && Value == other.Value;
    }


    public bool EqualsByColorAndValue(int? value, BidColor color) {
        return Color == color && Value == value;
    }


    /// <summary>
    /// Sprawdzenie, czy nowa odzywka z freestylu nie równa się niczemu wśród rodzeństwa oraz równoległych gałęzi.
    /// </summary>
    /// <param name="branchHead"></param>
    /// <returns></returns>
    public BidNode? AssertFreestyleIsntConfusing(Root openings, BidNode branchHead) {
        // Ścieżka do heada gałęzi.
        var path = branchHead.GetPath();

        // Idenyczne heady z innych gałęzi.
        var sameHeads = openings.GetNodesOnPath(path);

        // Fallback.
        if (sameHeads.Count == 0) {
            return this;
        }

        foreach (var head in sameHeads) {
            foreach (var node in branchHead.NextBids) {
                if (EqualsByColorAndValue(node)) {
                    return null;
                }
            }
        }

        return this;
    }


    public bool IsGameForcing() {
        if (GameForcing) {
            return true;
        }

        var parent = Parent;
        while (parent != null) {
            if (parent.GameForcing) {
                return true;
            }
            parent = parent.Parent;
        }

        return false;
    }


    public bool Equals(BidNode? x, BidNode? y) {
        return x?.Equals(y) ?? true;
    }


    public int GetHashCode([DisallowNull] BidNode obj) {
        return obj.NodeId.GetHashCode();
    }


    public int CompareTo(BidNode? other) {
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
