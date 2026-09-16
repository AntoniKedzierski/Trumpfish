using Model.Enums;

namespace Trumpfish.Server.Services;

/// <summary>
/// The contract search, as it is typed: "NT" for every no-trump contract, "1S" for every one spade, "1d, H" for every one
/// diamond and every contract in hearts.
/// </summary>
/// <remarks>
/// A term is a level, a denomination, or both, and the terms are separated by commas or spaces. Anything unreadable is
/// dropped rather than rejected: this is a filter being typed into, and half a term is what every search looks like while
/// it is still being written.
/// </remarks>
public static class ContractFilter {

    /// <summary>One thing the user asked for. Either half may be missing, and a term with both missing is not a term.</summary>
    public readonly record struct Term(int? Level, BidColor? Color);


    public static IReadOnlyList<Term> Parse(string? query) {
        if (string.IsNullOrWhiteSpace(query)) {
            return [];
        }

        var terms = new List<Term>();

        foreach (var piece in query.Split([',', ';', ' ', '\t'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)) {
            var term = ParseTerm(piece);
            if (term is { } value && (value.Level != null || value.Color != null)) {
                terms.Add(value);
            }
        }

        return terms;
    }


    private static Term? ParseTerm(string piece) {
        var digits = 0;
        while (digits < piece.Length && char.IsDigit(piece[digits])) {
            digits++;
        }

        int? level = null;
        if (digits > 0) {
            // A level outside the seven a bridge auction has is a typing slip, not a search for nothing.
            if (!int.TryParse(piece[..digits], out var parsed) || parsed < 1 || parsed > 7) {
                return null;
            }

            level = parsed;
        }

        return new Term(level, ParseColor(piece[digits..]));
    }


    /// <summary>The denomination as it is written on a bidding card: C, D, H, S and NT, with N on its own taken as no-trump.</summary>
    private static BidColor? ParseColor(string text) {
        return text.Trim().ToUpperInvariant() switch {
            "" => null,
            "C" => BidColor.Clubs,
            "D" => BidColor.Diamonds,
            "H" => BidColor.Hearts,
            "S" => BidColor.Spades,
            "N" or "NT" => BidColor.NoTrump,
            _ => null,
        };
    }
}
