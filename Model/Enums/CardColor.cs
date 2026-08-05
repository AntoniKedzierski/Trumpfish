using System.Text.Json.Serialization;

namespace Model.Enums;

[JsonConverter(typeof(JsonStringEnumConverter<CardColor>))]
public enum CardColor {
    Clubs,
    Diamonds,
    Hearts,
    Spades
}
