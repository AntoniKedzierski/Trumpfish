using Model.Bidding.AI;
using Model.Bidding.Bids;
using Model.Bidding.Validation.Constraints;
using Model.Enums;
using System.Text.RegularExpressions;

namespace Model.Bidding.Validation;

/// <summary>
/// Structural validation of a bidding system: speaker alternation, range sanity and partnership feasibility of points and suit lengths.
/// </summary>
public sealed class TreeValidator {

    private const int MinPc = 0;
    private const int MaxPc = 40;
    private const int MinCards = 0;
    private const int MaxCards = 13;

    private static readonly BidColor[] Suits = [BidColor.Clubs, BidColor.Diamonds, BidColor.Hearts, BidColor.Spades];

    /// <summary>Explicit range written anywhere in the text, e.g. "12-14 PC".</summary>
    private static readonly Regex PcRangePattern = new(@"(?<lower>\d{1,2})\s*[-–—]\s*(?<upper>\d{1,2})\s*PC\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    /// <summary>Open ended declarations, honoured only when they open the text, e.g. "Poniżej 9 PC" / "Powyżej 8 PC".</summary>
    private static readonly Regex BelowPcPattern = new(@"^\s*poniżej\s+(?<upper>\d{1,2})\s*PC\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex AbovePcPattern = new(@"^\s*powyżej\s+(?<lower>\d{1,2})\s*PC\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);


    public List<ValidationIssue> Validate(BiddingSystem system) {
        system.AssignParent();
        return Validate(system.Roots);
    }


    public List<ValidationIssue> Validate(IEnumerable<Root> roots) {
        var issues = new List<ValidationIssue>();

        foreach (var root in roots) {
            ValidateRoot(root, issues);
        }

        return issues;
    }


    private static void ValidateRoot(Root root, List<ValidationIssue> issues) {
        var rootName = string.IsNullOrWhiteSpace(root.Name) ? "<root>" : root.Name;
        var con = BiddingCon.CreateInitial(MinPc, MaxPc, MinCards, MaxCards);

        foreach (var bid in root.Bids) {
            ValidateBidSubtree(parent: null, current: bid, path: rootName, issues: issues, con: con);
        }
    }


    private static void ValidateBidSubtree(BidNode? parent, BidNode current, string path, List<ValidationIssue> issues, BiddingCon con) {
        var currentPath = $"{path} > {FormatBid(current)}";

        ValidateSpeakerAlternation(parent, current, currentPath, issues);
        ValidateBidRanges(current, currentPath, issues);

        if (!TryApplyPcConstraint(current, currentPath, issues, con, out var nextCon)) {
            return;
        }

        ValidateDeclaredPcText(current, nextCon, currentPath, issues);

        if (!TryApplySuitLengthConstraints(current, currentPath, issues, nextCon, out nextCon)) {
            return;
        }
        if (!ValidateHandSuitTotals(nextCon, current, currentPath, issues)) {
            return;
        }
        if (!ValidatePartnershipPc(nextCon, current, currentPath, issues)) {
            return;
        }
        if (!ValidatePartnershipSuitTotals(nextCon, current, currentPath, issues)) {
            return;
        }

        foreach (var child in current.NextBids) {
            ValidateBidSubtree(parent: current, current: child, path: currentPath, issues: issues, con: nextCon);
        }
    }


    private static void ValidateSpeakerAlternation(BidNode? parent, BidNode current, string currentPath, List<ValidationIssue> issues) {
        if (parent == null) {
            return;
        }

        if (parent.OpenerBid == current.OpenerBid) {
            issues.Add(Issue(current, currentPath, "Invalid speaker alternation: child has the same OpenerBid as parent."));
        }
    }


    private static void ValidateBidRanges(BidNode bid, string path, List<ValidationIssue> issues) {
        ValidateRange("PointsRange", bid.PointsRange, MinPc, MaxPc, bid, path, issues);
        ValidateRange("ClubsCardRange", bid.ClubsCardRange, MinCards, MaxCards, bid, path, issues);
        ValidateRange("DiamondsCardRange", bid.DiamondsCardRange, MinCards, MaxCards, bid, path, issues);
        ValidateRange("HeartsCardRange", bid.HeartsCardRange, MinCards, MaxCards, bid, path, issues);
        ValidateRange("SpadesCardRange", bid.SpadesCardRange, MinCards, MaxCards, bid, path, issues);
    }


    private static void ValidateRange(string rangeName, NumberRange? range, int minDomain, int maxDomain, BidNode bid, string path, List<ValidationIssue> issues) {
        if (range == null) {
            return;
        }

        var lower = range.Lower;
        var upper = range.Upper;

        if (lower.HasValue && upper.HasValue && lower.Value > upper.Value) {
            issues.Add(Issue(bid, path, $"{rangeName} is invalid: Lower ({lower}) > Upper ({upper})."));
        }
        if (lower.HasValue && (lower.Value < minDomain || lower.Value > maxDomain)) {
            issues.Add(Issue(bid, path, $"{rangeName}.Lower ({lower}) is outside domain [{minDomain}, {maxDomain}]."));
        }
        if (upper.HasValue && (upper.Value < minDomain || upper.Value > maxDomain)) {
            issues.Add(Issue(bid, path, $"{rangeName}.Upper ({upper}) is outside domain [{minDomain}, {maxDomain}]."));
        }
    }


    /// <summary>
    /// Compares the point range spelled out in the bid text ("12-14 PC", "Poniżej 9 PC", "Powyżej 8 PC") with everything the same player
    /// has already promised, because earlier bids may have capped one side of the range and later ones the other.
    /// A range without any text is fine - only a text contradicting the constraints is reported.
    /// </summary>
    private static void ValidateDeclaredPcText(BidNode bid, BiddingCon con, string path, List<ValidationIssue> issues) {
        var effective = bid.OpenerBid ? con.Opener.Pc : con.Responder.Pc;

        ValidateDeclaredPcText("Condition", bid.Condition, effective, bid, path, issues);
    }


    private static void ValidateDeclaredPcText(string fieldName, string? text, NumberRange effective, BidNode bid, string path, List<ValidationIssue> issues) {
        var declared = ParseDeclaredPc(text);
        if (declared == null) {
            return;
        }

        if (declared.Lower.HasValue && declared.Lower != effective.Lower) {
            issues.Add(Issue(bid, path, $"{fieldName} declares lower PC bound {declared.Lower} but the bidding so far implies {effective}."));
        }
        if (declared.Upper.HasValue && declared.Upper != effective.Upper) {
            issues.Add(Issue(bid, path, $"{fieldName} declares upper PC bound {declared.Upper} but the bidding so far implies {effective}."));
        }
    }


    private static NumberRange? ParseDeclaredPc(string? text) {
        if (string.IsNullOrWhiteSpace(text)) {
            return null;
        }

        var range = PcRangePattern.Match(text);
        if (range.Success) {
            return new NumberRange(int.Parse(range.Groups["lower"].Value), int.Parse(range.Groups["upper"].Value));
        }

        // "Poniżej N PC" means at most N - 1, "Powyżej N PC" at least N + 1; both count only when they open the text.
        var below = BelowPcPattern.Match(text);
        if (below.Success) {
            return new NumberRange(null, int.Parse(below.Groups["upper"].Value) - 1);
        }

        var above = AbovePcPattern.Match(text);
        if (above.Success) {
            return new NumberRange(int.Parse(above.Groups["lower"].Value) + 1, null);
        }

        return null;
    }


    private static bool TryApplyPcConstraint(BidNode current, string currentPath, List<ValidationIssue> issues, BiddingCon con, out BiddingCon nextCon) {
        nextCon = con;

        var constraint = current.PointsRange;
        if (constraint == null || (constraint.Lower == null && constraint.Upper == null)) {
            return true;
        }

        var role = current.OpenerBid ? "opener" : "responder";
        var currentRange = current.OpenerBid ? con.Opener.Pc : con.Responder.Pc;

        if (!RangeCon.TryIntersect(currentRange, constraint, out var narrowed)) {
            issues.Add(Issue(current, currentPath, $"Bid is impossible due to PC constraints ({role}). Constraint: {constraint}, Current: {currentRange}."));
            return false;
        }

        nextCon = current.OpenerBid ? con.WithOpenerPc(narrowed) : con.WithResponderPc(narrowed);
        return true;
    }


    private static bool TryApplySuitLengthConstraints(BidNode current, string currentPath, List<ValidationIssue> issues, BiddingCon con, out BiddingCon nextCon) {
        nextCon = con;

        foreach (var suit in Suits) {
            if (!TryApplyOneSuitLength(current, currentPath, issues, nextCon, suit, GetSuitConstraint(current, suit), out nextCon)) {
                return false;
            }
        }

        return true;
    }


    private static bool TryApplyOneSuitLength(BidNode current, string currentPath, List<ValidationIssue> issues, BiddingCon con, BidColor suit, NumberRange? constraint, out BiddingCon nextCon) {
        nextCon = con;

        if (constraint == null || (constraint.Lower == null && constraint.Upper == null)) {
            return true;
        }

        var isOpener = current.OpenerBid;
        var currentRange = con.GetSuitLength(isOpener, suit);

        if (!RangeCon.TryIntersect(currentRange, constraint, out var narrowed)) {
            var role = isOpener ? "opener" : "responder";
            issues.Add(Issue(current, currentPath, $"Bid is impossible due to suit length constraints ({role}). {suit}: Constraint: {constraint}, Current: {currentRange}."));
            return false;
        }

        nextCon = con.WithSuitLength(isOpener, suit, narrowed);
        return true;
    }


    private static bool ValidatePartnershipPc(BiddingCon con, BidNode current, string currentPath, List<ValidationIssue> issues) {
        var minSum = (con.Opener.Pc.Lower ?? MinPc) + (con.Responder.Pc.Lower ?? MinPc);

        if (minSum > MaxPc) {
            issues.Add(Issue(current, currentPath, $"Partnership PC impossible: min sum {minSum} > {MaxPc}. Opener {con.Opener.Pc}, Responder {con.Responder.Pc}."));
            return false;
        }

        return true;
    }


    /// <summary>A single hand holds exactly 13 cards, so the minimum lengths promised in all four suits must not exceed that.</summary>
    private static bool ValidateHandSuitTotals(BiddingCon con, BidNode current, string currentPath, List<ValidationIssue> issues) {
        foreach (var isOpener in new[] { true, false }) {
            var lengths = Suits.Select(suit => con.GetSuitLength(isOpener, suit)).ToArray();
            var minSum = lengths.Sum(length => length.Lower ?? MinCards);

            if (minSum > MaxCards) {
                var role = isOpener ? "opener" : "responder";
                var details = string.Join(", ", Suits.Select((suit, index) => $"{suit} {lengths[index]}"));
                issues.Add(Issue(current, currentPath, $"Hand impossible ({role}): min suit lengths sum to {minSum} > {MaxCards}. {details}."));
                return false;
            }
        }

        return true;
    }


    private static bool ValidatePartnershipSuitTotals(BiddingCon con, BidNode current, string currentPath, List<ValidationIssue> issues) {
        foreach (var suit in Suits) {
            var opener = con.GetSuitLength(opener: true, suit);
            var responder = con.GetSuitLength(opener: false, suit);
            var minSum = (opener.Lower ?? MinCards) + (responder.Lower ?? MinCards);

            if (minSum > MaxCards) {
                issues.Add(Issue(current, currentPath, $"Partnership {suit} length impossible: min sum {minSum} > {MaxCards}. Opener {opener}, Responder {responder}."));
                return false;
            }
        }

        return true;
    }


    private static NumberRange? GetSuitConstraint(BidNode bid, BidColor suit) {
        return suit switch {
            BidColor.Clubs => bid.ClubsCardRange,
            BidColor.Diamonds => bid.DiamondsCardRange,
            BidColor.Hearts => bid.HeartsCardRange,
            BidColor.Spades => bid.SpadesCardRange,
            _ => null
        };
    }


    private static ValidationIssue Issue(BidNode bid, string path, string message) {
        return new ValidationIssue(ValidationSeverity.Error, message, path, GetConventionContext(bid), bid.NodeId);
    }


    private static string FormatBid(BidNode bid) {
        var label = $"{bid.Value?.ToString() ?? ""}{BidCode(bid)}".Trim();
        return string.IsNullOrWhiteSpace(label) ? "<bid>" : label;
    }


    private static string BidCode(BidNode bid) {
        if (bid.Type == BidType.Pass) {
            return "Pass";
        }
        if (bid.Type == BidType.Double) {
            return "X";
        }
        if (bid.Type == BidType.Redouble) {
            return "XX";
        }

        return bid.Color switch {
            BidColor.Clubs => "♣",
            BidColor.Diamonds => "♦",
            BidColor.Hearts => "♥",
            BidColor.Spades => "♠",
            BidColor.NoTrump => "NT",
            _ => ""
        };
    }


    private static string? GetConventionContext(BidNode bid) {
        var conventions = new List<string>();

        for (BidNode? current = bid; current is not null; current = current.Parent) {
            if (!string.IsNullOrWhiteSpace(current.Convention)) {
                conventions.Add($"{FormatBid(current)}: {current.Convention.Trim()}");
            }
        }

        if (conventions.Count == 0) {
            return null;
        }

        conventions.Reverse();
        return string.Join(" | ", conventions);
    }
}
