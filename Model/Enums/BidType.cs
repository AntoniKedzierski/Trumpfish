using System.Text.Json.Serialization;

namespace Model.Enums;

[JsonConverter(typeof(JsonStringEnumConverter<BidType>))]
public enum BidType {
    Pass,
    Submit,
    Double,
    Redouble
}
