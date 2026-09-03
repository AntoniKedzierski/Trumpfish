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
    private static readonly Regex AbovePcPulsPattern = new(@"^(?<lower>\d{1,2})\+\s*PC\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);


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

        ValidateDeclaredSuitText(current, nextCon, currentPath, issues);

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
            issues.Add(Issue(current, currentPath, "Nieprawidłowa kolejność graczy: odzywka należy do tego samego gracza co jej rodzic."));
        }
    }


    private static void ValidateBidRanges(BidNode bid, string path, List<ValidationIssue> issues) {
        ValidateRange("Zakres punktów", bid.PointsRange, MinPc, MaxPc, bid, path, issues);
        ValidateRange("Układ trefli", bid.ClubsCardRange, MinCards, MaxCards, bid, path, issues);
        ValidateRange("Układ kar", bid.DiamondsCardRange, MinCards, MaxCards, bid, path, issues);
        ValidateRange("Układ kierów", bid.HeartsCardRange, MinCards, MaxCards, bid, path, issues);
        ValidateRange("Układ pików", bid.SpadesCardRange, MinCards, MaxCards, bid, path, issues);
    }


    private static void ValidateRange(string rangeName, NumberRange? range, int minDomain, int maxDomain, BidNode bid, string path, List<ValidationIssue> issues) {
        if (range == null) {
            return;
        }

        var lower = range.Lower;
        var upper = range.Upper;

        if (lower.HasValue && upper.HasValue && lower.Value > upper.Value) {
            issues.Add(Issue(bid, path, $"{rangeName}: dolny limit ({lower}) jest większy od górnego ({upper})."));
        }
        if (lower.HasValue && (lower.Value < minDomain || lower.Value > maxDomain)) {
            issues.Add(Issue(bid, path, $"{rangeName}: dolny limit ({lower}) jest poza dopuszczalnym przedziałem [{minDomain}, {maxDomain}]."));
        }
        if (upper.HasValue && (upper.Value < minDomain || upper.Value > maxDomain)) {
            issues.Add(Issue(bid, path, $"{rangeName}: górny limit ({upper}) jest poza dopuszczalnym przedziałem [{minDomain}, {maxDomain}]."));
        }
    }


    /// <summary>
    /// Compares the point range spelled out in the bid text ("12-14 PC", "Poniżej 9 PC", "Powyżej 8 PC") with everything the same player
    /// has already promised, because earlier bids may have capped one side of the range and later ones the other.
    /// A range without any text is fine - only a text contradicting the constraints is reported.
    /// </summary>
    private static void ValidateDeclaredPcText(BidNode bid, BiddingCon con, string path, List<ValidationIssue> issues) {
        var effective = bid.OpenerBid ? con.Opener.Pc : con.Responder.Pc;

        ValidateDeclaredPcText("Znaczenie", bid.Condition, effective, bid, path, issues);
    }


    private static void ValidateDeclaredPcText(string fieldName, string? text, NumberRange effective, BidNode bid, string path, List<ValidationIssue> issues) {
        var declared = ParseDeclaredPc(text);
        if (declared == null) {
            return;
        }

        // Which side is wrong follows from the direction of the disagreement, and the two repairs are exclusive because of it.
        // A description stating a tighter bound than the ranges is a promise the ranges failed to record, so the ranges are
        // repaired. A looser one cannot be met anyway - an earlier bid of the same player already imposes the narrower value -
        // so the description is the thing overstating, and it is rewritten to what the auction really implies.
        if (declared.Lower.HasValue && declared.Lower != effective.Lower) {
            var tightens = declared.Lower > (effective.Lower ?? MinPc);
            issues.Add(Issue(bid, path, $"{fieldName} podaje dolny limit {declared.Lower} PC, ale z dotychczasowej licytacji wynika {effective}.",
                tightens ? new RangeRepair("pointsRange", "lower", declared.Lower.Value) : null,
                tightens ? null : RepairedPcText(text, effective)));
        }
        if (declared.Upper.HasValue && declared.Upper != effective.Upper) {
            var tightens = declared.Upper < (effective.Upper ?? MaxPc);
            issues.Add(Issue(bid, path, $"{fieldName} podaje górny limit {declared.Upper} PC, ale z dotychczasowej licytacji wynika {effective}.",
                tightens ? new RangeRepair("pointsRange", "upper", declared.Upper.Value) : null,
                tightens ? null : RepairedPcText(text, effective)));
        }
    }


    /// <summary>
    /// Compares the suit lengths spelled out in the bid text ("5+ kierów", "brak 4 pików", "dokładnie 3 trefle") with what the
    /// same player has actually promised through the range fields, once everything said earlier is taken into account.
    /// </summary>
    /// <remarks>
    /// Only a description promising <em>more</em> than the ranges do is reported. The engine reads the ranges alone, so a
    /// length stated in prose and nowhere else is a promise nobody acts on.
    /// <para>
    /// Restating a length the sequence already guarantees is how these systems are written and must stay silent - a bid saying
    /// "5+ pików" need not repeat the range when an earlier bid of the same player established it. That holds whether the
    /// restatement is exact or looser than what was established; it only says something already true.
    /// </para>
    /// </remarks>
    private static void ValidateDeclaredSuitText(BidNode bid, BiddingCon con, string path, List<ValidationIssue> issues) {
        foreach (var (suit, declared) in ConditionReader.ReadSuitLengths(bid.Condition)) {
            var effective = con.GetSuitLength(bid.OpenerBid, suit);

            // Every one of these is settled by writing the stated bound: it tightens the range, which is what was missing.
            if (declared.Lower.HasValue && declared.Lower > (effective.Lower ?? MinCards)) {
                issues.Add(Issue(bid, path, $"Znaczenie obiecuje co najmniej {declared.Lower} kart w kolorze {SuitName(suit)}, ale z zakresów wynika tylko {effective}.", new RangeRepair(SuitField(suit), "lower", declared.Lower.Value)));
            }
            if (declared.Upper.HasValue && declared.Upper < (effective.Upper ?? MaxCards)) {
                issues.Add(Issue(bid, path, $"Znaczenie obiecuje najwyżej {declared.Upper} kart w kolorze {SuitName(suit)}, ale z zakresów wynika tylko {effective}.", new RangeRepair(SuitField(suit), "upper", declared.Upper.Value)));
            }
        }
    }


    /// <summary>
    /// The description with its point range rewritten to what the bidding implies, or null when there is nothing to rewrite.
    /// Only the phrase the parser recognised is touched; the prose around it is left exactly as the author wrote it.
    /// </summary>
    private static string? RepairedPcText(string? text, NumberRange effective) {
        var replacement = FormatPc(effective);
        if (text == null || replacement == null) {
            return null;
        }

        foreach (var pattern in new[] { PcRangePattern, BelowPcPattern, AbovePcPattern, AbovePcPulsPattern }) {
            var match = pattern.Match(text);
            if (!match.Success) {
                continue;
            }

            var repaired = string.Concat(text.AsSpan(0, match.Index), replacement, text.AsSpan(match.Index + match.Length));
            return repaired == text ? null : repaired;
        }

        return null;
    }


    /// <summary>Writes a point range the way the descriptions write them, so a repaired text still reads like the rest.</summary>
    private static string? FormatPc(NumberRange range) {
        if (range.Lower.HasValue && range.Upper.HasValue) {
            return $"{range.Lower}-{range.Upper} PC";
        }
        if (range.Lower.HasValue) {
            return $"{range.Lower}+ PC";
        }

        return range.Upper.HasValue ? $"Poniżej {range.Upper} PC" : null;
    }


    private static NumberRange? ParseDeclaredPc(string? text) {
        if (string.IsNullOrWhiteSpace(text)) {
            return null;
        }

        var range = PcRangePattern.Match(text);
        if (range.Success) {
            return new NumberRange(int.Parse(range.Groups["lower"].Value), int.Parse(range.Groups["upper"].Value));
        }

        // "Poniżej N PC" means N or fewer and "Powyżej N PC" N or more: the phrase names the bound rather than excluding it.
        // Both count only when they open the text.
        var below = BelowPcPattern.Match(text);
        if (below.Success) {
            return new NumberRange(null, int.Parse(below.Groups["upper"].Value));
        }

        var above = AbovePcPattern.Match(text);
        if (above.Success) {
            return new NumberRange(int.Parse(above.Groups["lower"].Value), null);
        }

        var abovePlus = AbovePcPulsPattern.Match(text);
        if (abovePlus.Success) {
            return new NumberRange(int.Parse(abovePlus.Groups["lower"].Value), null);
        }

        return null;
    }


    private static bool TryApplyPcConstraint(BidNode current, string currentPath, List<ValidationIssue> issues, BiddingCon con, out BiddingCon nextCon) {
        nextCon = con;

        var constraint = current.PointsRange;
        if (constraint == null || (constraint.Lower == null && constraint.Upper == null)) {
            return true;
        }

        var role = RoleName(current.OpenerBid);
        var currentRange = current.OpenerBid ? con.Opener.Pc : con.Responder.Pc;

        if (!RangeCon.TryIntersect(currentRange, constraint, out var narrowed)) {
            issues.Add(Issue(current, currentPath, $"Odzywka niemożliwa przez ograniczenia punktowe ({role}). Warunek: {constraint}, dotychczas: {currentRange}."));
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
            issues.Add(Issue(current, currentPath, $"Odzywka niemożliwa przez długość koloru ({RoleName(isOpener)}), {SuitName(suit)}. Warunek: {constraint}, dotychczas: {currentRange}."));
            return false;
        }

        nextCon = con.WithSuitLength(isOpener, suit, narrowed);
        return true;
    }


    private static bool ValidatePartnershipPc(BiddingCon con, BidNode current, string currentPath, List<ValidationIssue> issues) {
        var minSum = (con.Opener.Pc.Lower ?? MinPc) + (con.Responder.Pc.Lower ?? MinPc);

        if (minSum > MaxPc) {
            issues.Add(Issue(current, currentPath, $"Punkty pary niemożliwe: minimalna suma {minSum} przekracza {MaxPc}. Otwierający {con.Opener.Pc}, odpowiadający {con.Responder.Pc}."));
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
                var details = string.Join(", ", Suits.Select((suit, index) => $"{SuitName(suit)} {lengths[index]}"));
                issues.Add(Issue(current, currentPath, $"Ręka niemożliwa ({RoleName(isOpener)}): minimalne długości kolorów sumują się do {minSum}, a ręka ma {MaxCards} kart. {details}."));
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
                issues.Add(Issue(current, currentPath, $"Długość koloru {SuitName(suit)} u pary niemożliwa: minimalna suma {minSum} przekracza {MaxCards}. Otwierający {opener}, odpowiadający {responder}."));
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


    private static ValidationIssue Issue(BidNode bid, string path, string message, RangeRepair? repair = null, string? conditionRepair = null) {
        return new ValidationIssue(ValidationSeverity.Error, message, path, GetConventionContext(bid), bid.NodeId, repair, conditionRepair);
    }


    /// <summary>Suit as the messages name it; the enum spells them in English, the messages are read in Polish.</summary>
    private static string SuitName(BidColor suit) => suit switch {
        BidColor.Clubs => "trefle",
        BidColor.Diamonds => "kara",
        BidColor.Hearts => "kiery",
        BidColor.Spades => "piki",
        BidColor.NoTrump => "bez atu",
        _ => "brak koloru"
    };


    private static string RoleName(bool isOpener) => isOpener ? "otwierający" : "odpowiadający";


    /// <summary>Range field of a suit, named as the wire spells it, so the client can apply a repair without translating.</summary>
    private static string SuitField(BidColor suit) => suit switch {
        BidColor.Clubs => "clubsCardRange",
        BidColor.Diamonds => "diamondsCardRange",
        BidColor.Hearts => "heartsCardRange",
        _ => "spadesCardRange"
    };


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
