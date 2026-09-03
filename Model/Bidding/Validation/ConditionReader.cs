using Model.Enums;
using System.Text.RegularExpressions;

namespace Model.Bidding.Validation;

/// <summary>
/// Reads the suit lengths a bid promises in its own description, so the prose a human reads can be checked against the ranges
/// the engine actually acts on.
/// </summary>
/// <remarks>
/// Deliberately the same reading the Bidding Browser performs on Shift+Enter, down to the patterns, so an author who fills the
/// range fields from the text cannot then be told by the validator that the two disagree.
/// </remarks>
public static class ConditionReader {

    /// <summary>
    /// Suits are told apart by the first two letters of the word, as the descriptions write them.
    /// <para>
    /// <c>ka</c> must not swallow "kart", "kartowy" or "karty": those count cards rather than name diamonds, and they sit in
    /// exactly the position a suit would - "4+ kartowy fit" is a four card fit, not four diamonds.
    /// </para>
    /// </summary>
    private const string SuitMarkers = @"tr|ka(?!rt)|ki|pi";

    /// <summary>"5+ kierów" - a floor on the suit.</summary>
    private static readonly Regex AtLeastPattern = new($@"(\d{{1,2}})\s*\+\s*({SuitMarkers})", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    /// <summary>"brak 4 pików" - denying four means holding at most three.</summary>
    private static readonly Regex AtMostPattern = new($@"brak\s+(\d{{1,2}})\s*({SuitMarkers})", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    /// <summary>"dokładnie 5 trefli" - both ends at once.</summary>
    private static readonly Regex ExactlyPattern = new($@"dok[łl]adnie\s+(\d{{1,2}})\s*({SuitMarkers})", RegexOptions.IgnoreCase | RegexOptions.Compiled);


    /// <summary>
    /// Suit lengths stated in <paramref name="condition"/>. The text is taken a comma separated section at a time and a section
    /// that states nothing recognisable is skipped, which is what lets the prose around the numbers stay prose.
    /// </summary>
    public static IReadOnlyDictionary<BidColor, NumberRange> ReadSuitLengths(string? condition) {
        var lengths = new Dictionary<BidColor, NumberRange>();
        if (string.IsNullOrWhiteSpace(condition)) {
            return lengths;
        }

        foreach (var section in condition.Split(',')) {
            // Bounds are merged rather than replaced, so a section naming a floor and another naming a ceiling both land.
            Collect(AtLeastPattern, section, lengths, (current, count) => new NumberRange(count, current?.Upper));
            Collect(AtMostPattern, section, lengths, (current, count) => new NumberRange(current?.Lower, Math.Max(0, count - 1)));
            Collect(ExactlyPattern, section, lengths, (_, count) => new NumberRange(count, count));
        }

        return lengths;
    }


    private static void Collect(Regex pattern, string section, Dictionary<BidColor, NumberRange> lengths, Func<NumberRange?, int, NumberRange> merge) {
        foreach (Match match in pattern.Matches(section)) {
            if (!int.TryParse(match.Groups[1].Value, out var count)) {
                continue;
            }

            var suit = SuitFor(match.Groups[2].Value);
            lengths.TryGetValue(suit, out var current);
            lengths[suit] = merge(current, count);
        }
    }


    private static BidColor SuitFor(string marker) => marker.ToLowerInvariant() switch {
        "tr" => BidColor.Clubs,
        "ka" => BidColor.Diamonds,
        "ki" => BidColor.Hearts,
        _ => BidColor.Spades
    };
}
