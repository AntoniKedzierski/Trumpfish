using Model;
using Model.Enums;

namespace Trumpfish.Server.Services;

/// <summary>One bid the human made, kept so the whole auction can be replayed from the top.</summary>
public record PracticeStoredBid(BidType Type, BidColor Color, int? Value);

/// <summary>
/// Everything a practice deal needs to be rebuilt, travelling to the client and back as one signed, opaque string.
/// </summary>
/// <remarks>
/// Only the human's own bids are kept: the engine is deterministic, so replaying the auction from the deal reproduces the bots'
/// bids exactly, and the state stays a few hundred bytes however long the auction runs. It also means the bots' reasoning is
/// rebuilt along with it rather than having to be carried around.
/// </remarks>
public record PracticeStateData(
    Guid SystemId,
    int DealIndex,
    PlayerPosition Dealer,
    PlayerPosition Player,
    Guid? OpeningNodeId,
    bool CheckBids,
    IReadOnlyList<string> Hands,
    IReadOnlyList<PracticeStoredBid> Bids);

/// <summary>Packs a hand into a short string, so the state a client carries around stays small.</summary>
internal static class CardCodec {

    private const string Values = "23456789TJQKA";
    private const string Colors = "cdhs";


    public static string Encode(IEnumerable<Card> cards) {
        return string.Concat(cards.Select(card => $"{Values[(int)card.Value]}{Colors[(int)card.Color]}"));
    }


    public static List<Card>? Decode(string cards) {
        if (cards.Length % 2 != 0) {
            return null;
        }

        var decoded = new List<Card>(cards.Length / 2);

        for (var i = 0; i < cards.Length; i += 2) {
            var value = Values.IndexOf(cards[i]);
            var color = Colors.IndexOf(cards[i + 1]);
            if (value < 0 || color < 0) {
                return null;
            }

            decoded.Add(new Card((CardValue)value, (CardColor)color));
        }

        return decoded;
    }
}
