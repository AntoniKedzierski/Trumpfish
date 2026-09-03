namespace Trumpfish.Server.Configuration;

/// <summary>
/// The build configuration, resolved once here so nothing else needs a <c>#if</c>. The value is also handed to the client,
/// which keeps developer-only commands out of a deployed build without the front end knowing how the server was compiled.
/// </summary>
public static class BuildInfo {

#if DEBUG
    public const bool IsDebug = true;
#else
    public const bool IsDebug = false;
#endif
}
