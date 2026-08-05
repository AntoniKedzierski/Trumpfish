namespace Model.Bidding.Validation;

public sealed class ValidationIssue {

    public ValidationSeverity Severity { get; }

    public string Message { get; }

    public string Path { get; }

    public string? ConventionContext { get; }


    public ValidationIssue(ValidationSeverity severity, string message, string path, string? conventionContext = null) {
        Severity = severity;
        Message = message;
        Path = path;
        ConventionContext = string.IsNullOrWhiteSpace(conventionContext) ? null : conventionContext;
    }


    public override string ToString() {
        var conventionSuffix = ConventionContext is null ? string.Empty : $", Convention: {ConventionContext}";
        return $"{Severity}: {Message} (Path: {Path}{conventionSuffix})";
    }
}
