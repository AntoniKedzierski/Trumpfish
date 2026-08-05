using System.Text.Json.Serialization;

namespace Model.Bidding.Validation;

[JsonConverter(typeof(JsonStringEnumConverter<ValidationSeverity>))]
public enum ValidationSeverity {
    Info,
    Warning,
    Error
}
