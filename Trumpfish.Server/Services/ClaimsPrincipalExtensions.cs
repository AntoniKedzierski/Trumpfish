using System.Security.Claims;

namespace Trumpfish.Server.Services;

public static class ClaimsPrincipalExtensions {

    /// <summary>Account id carried by the authentication cookie, or null when the request is anonymous.</summary>
    public static Guid? GetUserId(this ClaimsPrincipal principal) {
        var value = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(value, out var id) ? id : null;
    }


    /// <summary>Account id for a request that already passed <c>[Authorize]</c>, where an anonymous caller is a bug rather than a case to handle.</summary>
    public static Guid RequireUserId(this ClaimsPrincipal principal) {
        return principal.GetUserId() ?? throw new InvalidOperationException("The request is not authenticated.");
    }


    /// <summary>Whether the caller curates the seed systems.</summary>
    public static bool IsAdmin(this ClaimsPrincipal principal) => principal.IsInRole(Roles.Admin);
}
