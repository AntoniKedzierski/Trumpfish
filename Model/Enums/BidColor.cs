using System.Text.Json.Serialization;

namespace Model.Enums;

[JsonConverter(typeof(JsonStringEnumConverter<BidColor>))]
public enum BidColor {
    NoColor,
    Clubs,
    Diamonds,
    Hearts,
    Spades,
    NoTrump
}
