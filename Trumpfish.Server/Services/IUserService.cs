using Trumpfish.Server.Data;

namespace Trumpfish.Server.Services;

/// <summary>Thrown when an account cannot be created because the name is already taken.</summary>
public sealed class UsernameTakenException(string username) : Exception($"The username '{username}' is already taken.") {

    public string Username { get; } = username;
}


public interface IUserService {

    Task<UserRecord?> FindByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<UserRecord?> FindByUsernameAsync(string username, CancellationToken cancellationToken = default);

    /// <summary>Returns the account when the credentials match, otherwise null. Upgrades the stored hash when its cost factor is out of date.</summary>
    Task<UserRecord?> ValidateCredentialsAsync(string username, string password, CancellationToken cancellationToken = default);

    /// <exception cref="UsernameTakenException">The username is already in use.</exception>
    Task<UserRecord> CreateAsync(string username, string password, bool isAdmin = false, string? displayName = null, CancellationToken cancellationToken = default);

    /// <summary>Returns false when <paramref name="currentPassword"/> does not match, leaving the account untouched.</summary>
    Task<bool> ChangePasswordAsync(Guid id, string currentPassword, string newPassword, CancellationToken cancellationToken = default);

    Task<UserRecord?> UpdateProfileAsync(Guid id, string? displayName, CancellationToken cancellationToken = default);
}
