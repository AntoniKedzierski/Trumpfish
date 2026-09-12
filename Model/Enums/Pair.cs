using System.Text.Json.Serialization;

namespace Model.Enums;

/// <summary>The two sides of the table. A contract belongs to a pair; which of its two hands declares is a separate question.</summary>
[JsonConverter(typeof(JsonStringEnumConverter<Pair>))]
public enum Pair {
    NorthSouth,
    EastWest
}
