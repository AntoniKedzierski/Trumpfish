namespace Model.Bidding.Validation;

public sealed class ValidationIssue {

    public ValidationSeverity Severity { get; }

    public string Message { get; }

    public string Path { get; }

    /// <summary>Identity of the bid the issue belongs to; lets clients navigate precisely when several bids share the same path.</summary>
    public Guid? NodeId { get; }

    public string? ConventionContext { get; }


    public ValidationIssue(ValidationSeverity severity, string message, string path, string? conventionContext = null, Guid? nodeId = null) {
        Severity = severity;
        Message = message;
        Path = path;
        NodeId = nodeId;
        ConventionContext = string.IsNullOrWhiteSpace(conventionContext) ? null : conventionContext;
    }


    public override string ToString() {
        var conventionSuffix = ConventionContext is null ? string.Empty : $", Convention: {ConventionContext}";
        return $"{Severity}: {Message} (Path: {Path}{conventionSuffix})";
    }
}
