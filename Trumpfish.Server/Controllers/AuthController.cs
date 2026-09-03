using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Trumpfish.Server.Configuration;
using Trumpfish.Server.Contracts;
using Trumpfish.Server.Data;
using Trumpfish.Server.Services;

namespace Trumpfish.Server.Controllers;

/// <summary>
/// Username and password sign in over an authentication cookie. Deliberately minimal - it is the placeholder scheme that a real
/// identity provider will replace - so it owns nothing beyond the session and the account's own profile.
/// </summary>
[ApiController]
[Route("api/auth")]
[Produces("application/json")]
public class AuthController : ControllerBase {

    private readonly IUserService _users;


    public AuthController(IUserService users) {
        _users = users;
    }


    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType<CurrentUser>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<CurrentUser>> Login([FromBody] LoginRequest request, CancellationToken cancellationToken) {
        var user = await _users.ValidateCredentialsAsync(request.Username, request.Password, cancellationToken);
        if (user == null) {
            // The same answer for an unknown account and a wrong password, so the response cannot be used to enumerate names.
            return Unauthorized("Nieprawidłowa nazwa użytkownika lub hasło.");
        }

        await SignInAsync(user);
        return Ok(Describe(user));
    }


    [HttpPost("register")]
    [AllowAnonymous]
    [ProducesResponseType<CurrentUser>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CurrentUser>> Register([FromBody] RegisterRequest request, CancellationToken cancellationToken) {
        try {
            // Self registration never grants administrator rights; the only administrator is the seeded one.
            var user = await _users.CreateAsync(request.Username, request.Password, isAdmin: false, request.DisplayName, cancellationToken);
            await SignInAsync(user);
            return Ok(Describe(user));
        }
        catch (UsernameTakenException) {
            return Conflict("Ta nazwa użytkownika jest już zajęta.");
        }
    }


    [HttpPost("logout")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Logout() {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return NoContent();
    }


    [HttpGet("me")]
    [Authorize]
    [ProducesResponseType<CurrentUser>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<CurrentUser>> Me(CancellationToken cancellationToken) {
        var user = await _users.FindByIdAsync(User.RequireUserId(), cancellationToken);
        if (user == null) {
            // The cookie outlived the account it points at, so drop it rather than reporting a session that cannot be used.
            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Unauthorized();
        }

        return Ok(Describe(user));
    }


    [HttpPost("password")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request, CancellationToken cancellationToken) {
        if (!await _users.ChangePasswordAsync(User.RequireUserId(), request.CurrentPassword, request.NewPassword, cancellationToken)) {
            return BadRequest("Aktualne hasło jest nieprawidłowe.");
        }

        return NoContent();
    }


    [HttpPut("profile")]
    [Authorize]
    [ProducesResponseType<CurrentUser>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CurrentUser>> UpdateProfile([FromBody] UpdateProfileRequest request, CancellationToken cancellationToken) {
        var user = await _users.UpdateProfileAsync(User.RequireUserId(), request.DisplayName, cancellationToken);
        if (user == null) {
            return NotFound();
        }

        return Ok(Describe(user));
    }


    private Task SignInAsync(UserRecord user) {
        var claims = new List<Claim> {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.Username)
        };

        if (user.IsAdmin) {
            claims.Add(new Claim(ClaimTypes.Role, Roles.Admin));
        }

        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);

        return HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity), new AuthenticationProperties { IsPersistent = true });
    }


    private static CurrentUser Describe(UserRecord user) {
        return new CurrentUser(user.Id, user.Username, user.DisplayName, user.IsAdmin, BuildInfo.IsDebug);
    }
}
