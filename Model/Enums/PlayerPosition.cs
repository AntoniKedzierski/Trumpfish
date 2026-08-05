using System.Text.Json.Serialization;

namespace Model.Enums;

[JsonConverter(typeof(JsonStringEnumConverter<PlayerPosition>))]
public enum PlayerPosition {
    North,
    East,
    South,
    West
}
