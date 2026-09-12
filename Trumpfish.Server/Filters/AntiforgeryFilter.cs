using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Trumpfish.Server.Filters;

/// <summary>
/// Rejects a mutating request that does not carry a matching antiforgery token. Applied to the whole controller surface, so an
/// endpoint added later is covered without anybody having to remember an attribute.
/// </summary>
/// <remarks>
/// MVC ships <c>AutoValidateAntiforgeryTokenAttribute</c> for this, but it resolves a filter that only <c>AddControllersWithViews</c>
/// registers - this application has no views and has no reason to pull the Razor engine in for one filter. Doing it here also
/// makes the answer to a rejected token part of the contract rather than a framework default the client has to guess at.
/// </remarks>
public sealed class AntiforgeryFilter : IAsyncAuthorizationFilter {

    /// <summary>
    /// Set on the rejection, so the client can tell a stale token - which is what an expired session or a sign in from another
    /// tab leaves behind, and which is worth one silent retry - from a request the server genuinely refused.
    /// </summary>
    public const string FailureHeader = "X-Antiforgery";

    /// <summary>The methods that only read. Everything else has to prove where it came from.</summary>
    private static readonly HashSet<string> SafeMethods = new(StringComparer.OrdinalIgnoreCase) { "GET", "HEAD", "OPTIONS", "TRACE" };

    private readonly IAntiforgery _antiforgery;


    public AntiforgeryFilter(IAntiforgery antiforgery) {
        _antiforgery = antiforgery;
    }


    public async Task OnAuthorizationAsync(AuthorizationFilterContext context) {
        if (SafeMethods.Contains(context.HttpContext.Request.Method)) {
            return;
        }

        try {
            await _antiforgery.ValidateRequestAsync(context.HttpContext);
        }
        catch (AntiforgeryValidationException) {
            // Deliberately without a body: there is nothing here for a person to read, and the header is what the client reads.
            context.HttpContext.Response.Headers[FailureHeader] = "invalid";
            context.Result = new StatusCodeResult(StatusCodes.Status400BadRequest);
        }
    }
}
