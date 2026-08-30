using System.ComponentModel.DataAnnotations;

namespace Trumpfish.Server.Contracts;

public record LoginRequest([Required] string Username, [Required] string Password);

public record RegisterRequest([Required, StringLength(64, MinimumLength = 3)] string Username, [Required, StringLength(128, MinimumLength = 6)] string Password, string? DisplayName);

public record ChangePasswordRequest([Required] string CurrentPassword, [Required, StringLength(128, MinimumLength = 6)] string NewPassword);

public record UpdateProfileRequest([StringLength(128)] string? DisplayName);

/// <summary>
/// The signed in account as the client sees it. <paramref name="IsAdmin"/> is what tells the client it is editing seeds rather
/// than systems of its own, and that forking is not on offer.
/// </summary>
public record CurrentUser(Guid Id, string Username, string? DisplayName, bool IsAdmin);
