namespace Model.Bidding.Validation.Constraints;

/// <summary>Intersection helpers for <see cref="NumberRange"/> treated as a closed interval constraint.</summary>
public static class RangeCon {

    public static bool TryIntersect(NumberRange current, NumberRange constraint, out NumberRange result) {
        result = new NumberRange(MaxNullable(current.Lower, constraint.Lower), MinNullable(current.Upper, constraint.Upper));
        return !IsEmpty(result);
    }


    public static bool IsEmpty(NumberRange range) {
        return range.Lower.HasValue && range.Upper.HasValue && range.Lower.Value > range.Upper.Value;
    }


    private static int? MaxNullable(int? x, int? y) {
        if (!x.HasValue) {
            return y;
        }
        if (!y.HasValue) {
            return x;
        }
        return Math.Max(x.Value, y.Value);
    }


    private static int? MinNullable(int? x, int? y) {
        if (!x.HasValue) {
            return y;
        }
        if (!y.HasValue) {
            return x;
        }
        return Math.Min(x.Value, y.Value);
    }
}
