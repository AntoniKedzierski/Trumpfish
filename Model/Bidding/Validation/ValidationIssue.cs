namespace Model.Bidding.Validation;

public sealed class ValidationIssue {

    public ValidationSeverity Severity { get; }

    public string Message { get; }

    public string Path { get; }

    /// <summary>Identity of the bid the issue belongs to; lets clients navigate precisely when several bids share the same path.</summary>
    public Guid? NodeId { get; }

    public string? ConventionContext { get; }

    /// <summary>Bound the editor can write to settle this issue, or null when it cannot be settled by a single value.</summary>
    public RangeRepair? Repair { get; }

    /// <summary>
    /// The bid's description, rewritten to say what the bidding actually implies. Set on the opposite case to <see cref="Repair"/>:
    /// there the description is right and the ranges lag behind, here the ranges are right and the description overstates them.
    /// </summary>
    public string? ConditionRepair { get; }


    public ValidationIssue(ValidationSeverity severity, string message, string path, string? conventionContext = null, Guid? nodeId = null, RangeRepair? repair = null, string? conditionRepair = null) {
        Severity = severity;
        Message = message;
        Path = path;
        NodeId = nodeId;
        ConventionContext = string.IsNullOrWhiteSpace(conventionContext) ? null : conventionContext;
        Repair = repair;
        ConditionRepair = conditionRepair;
    }


    public override string ToString() {
        var conventionSuffix = ConventionContext is null ? string.Empty : $", Convention: {ConventionContext}";
        return $"{Severity}: {Message} (Path: {Path}{conventionSuffix})";
    }
}
