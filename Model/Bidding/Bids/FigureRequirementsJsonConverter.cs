using Model.Enums;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Model.Bidding.Bids;

/// <summary>
/// Writes the complex keys of <see cref="BidNode.Figures"/> as stable JSON property names, for example
/// <c>"Ace.Spades": true</c>. JSON objects can only carry string keys, so the format is shared with the bidding browser.
/// </summary>
public sealed class FigureRequirementsJsonConverter : JsonConverter<Dictionary<Card, bool>> {

    public override Dictionary<Card, bool> Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) {
        if (reader.TokenType != JsonTokenType.StartObject) {
            throw new JsonException("Figure requirements must be a JSON object.");
        }

        var requirements = new Dictionary<Card, bool>();

        while (reader.Read()) {
            if (reader.TokenType == JsonTokenType.EndObject) {
                return requirements;
            }

            if (reader.TokenType != JsonTokenType.PropertyName) {
                throw new JsonException("A figure requirement must have a card key.");
            }

            var card = ParseKey(reader.GetString());
            if (!reader.Read() || reader.TokenType is not (JsonTokenType.True or JsonTokenType.False)) {
                throw new JsonException($"The figure requirement for '{FormatKey(card)}' must be true or false.");
            }

            requirements.Add(card, reader.GetBoolean());
        }

        throw new JsonException("The figure requirements object is incomplete.");
    }


    public override void Write(Utf8JsonWriter writer, Dictionary<Card, bool> value, JsonSerializerOptions options) {
        writer.WriteStartObject();

        // A fixed order keeps exported seed files stable no matter in which order the matrix cells were selected.
        foreach (var requirement in value.OrderByDescending(entry => entry.Key.Value).ThenByDescending(entry => entry.Key.Color)) {
            writer.WriteBoolean(FormatKey(requirement.Key), requirement.Value);
        }

        writer.WriteEndObject();
    }


    private static string FormatKey(Card card) {
        if (!Enum.IsDefined(card.Value) || !Enum.IsDefined(card.Color)) {
            throw new JsonException("A figure requirement contains an invalid card.");
        }

        return $"{card.Value}.{card.Color}";
    }


    private static Card ParseKey(string? key) {
        var parts = key?.Split('.', StringSplitOptions.TrimEntries);
        if (parts?.Length != 2
            || !Enum.TryParse(parts[0], ignoreCase: false, out CardValue value)
            || !Enum.IsDefined(value)
            || !Enum.TryParse(parts[1], ignoreCase: false, out CardColor color)
            || !Enum.IsDefined(color)) {
            throw new JsonException($"'{key}' is not a valid figure requirement key. Expected for example 'Ace.Spades'.");
        }

        return new Card(value, color);
    }
}
