namespace Trumpfish.Server.Services.Dds;

/// <summary>A DDS call that came back with something other than success, carrying the library's own words for it.</summary>
public class DdsException : Exception {

    /// <summary>The library's return code. Negative; the meanings are listed in its <c>dll.h</c>.</summary>
    public int Code { get; }


    public DdsException(int code) : base($"Solver DDS zwrócił błąd {code}: {DdsNative.DescribeError(code)}") {
        Code = code;
    }
}
