using System.ComponentModel.DataAnnotations;

namespace Trumpfish.Server.Contracts;

public record LoginRequest([Required] string Username, [Required] string Password);

public record RegisterRequest([Required, StringLength(64, MinimumLength = 3)] string Username, [Required, StringLength(128, MinimumLength = 6)] string Password, string? DisplayName);

public record ChangePasswordRequest([Required] string CurrentPassword, [Required, StringLength(128, MinimumLength = 6)] string NewPassword);

public record UpdateProfileRequest([StringLength(128)] string? DisplayName);

/// <summary>
/// The half of the antiforgery pair that travels in a header. Its companion is set as a cookie by the same request, and a
/// mutating call is accepted only when both arrive and match.
/// </summary>
/// <remarks>
/// The token is bound to the signed in account, so one taken while anonymous stops being valid the moment somebody signs in.
/// A client has to ask for a fresh one after every change of identity.
/// </remarks>
public record AntiforgeryToken(string Token);

/// <summary>
/// The signed in account as the client sees it. <paramref name="IsAdmin"/> is what tells the client it is editing seeds rather
/// than systems of its own, and that forking is not on offer.
/// </summary>
/// <param name="IsDebugBuild">
/// Whether the server was compiled in Debug. Sent so the client can gate developer-only commands on a plain flag instead of
/// having a build-time switch of its own; the server stays the single place that knows how it was built.
/// </param>
public record CurrentUser(Guid Id, string Username, string? DisplayName, bool IsAdmin, bool IsDebugBuild);
