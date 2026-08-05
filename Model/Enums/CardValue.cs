using System.Text.Json.Serialization;

namespace Model.Enums;

[JsonConverter(typeof(JsonStringEnumConverter<CardValue>))]
public enum CardValue {
    Two,
    Three,
    Four,
    Five,
    Six,
    Seven,
    Eight,
    Nine,
    Ten,
    Jack,
    Queen,
    King,
    Ace
}
