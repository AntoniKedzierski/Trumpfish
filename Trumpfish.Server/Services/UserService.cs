using Microsoft.EntityFrameworkCore;
using Trumpfish.Server.Data;

namespace Trumpfish.Server.Services;

public class UserService : IUserService {

    private readonly TrumpfishDbContext _db;
    private readonly IPasswordHasher _hasher;


    public UserService(TrumpfishDbContext db, IPasswordHasher hasher) {
        _db = db;
        _hasher = hasher;
    }


    public Task<UserRecord?> FindByIdAsync(Guid id, CancellationToken cancellationToken = default) {
        return _db.Users.FirstOrDefaultAsync(user => user.Id == id, cancellationToken);
    }


    public Task<UserRecord?> FindByUsernameAsync(string username, CancellationToken cancellationToken = default) {
        var normalized = UserRecord.Normalize(username);
        return _db.Users.FirstOrDefaultAsync(user => user.NormalizedUsername == normalized, cancellationToken);
    }


    public async Task<UserRecord?> ValidateCredentialsAsync(string username, string password, CancellationToken cancellationToken = default) {
        var user = await FindByUsernameAsync(username, cancellationToken);
        if (user == null || !_hasher.Verify(password, user.PasswordHash)) {
            return null;
        }

        if (_hasher.NeedsRehash(user.PasswordHash)) {
            user.PasswordHash = _hasher.Hash(password);
            await _db.SaveChangesAsync(cancellationToken);
        }

        return user;
    }


    public async Task<UserRecord> CreateAsync(string username, string password, bool isAdmin = false, string? displayName = null, CancellationToken cancellationToken = default) {
        var trimmed = username.Trim();
        if (await FindByUsernameAsync(trimmed, cancellationToken) != null) {
            throw new UsernameTakenException(trimmed);
        }

        var user = new UserRecord {
            Username = trimmed,
            NormalizedUsername = UserRecord.Normalize(trimmed),
            PasswordHash = _hasher.Hash(password),
            DisplayName = string.IsNullOrWhiteSpace(displayName) ? null : displayName.Trim(),
            IsAdmin = isAdmin
        };

        _db.Users.Add(user);

        try {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException) {
            // Two registrations racing for the same name: the unique index is what actually arbitrates, not the check above.
            _db.Entry(user).State = EntityState.Detached;

            if (await FindByUsernameAsync(trimmed, cancellationToken) != null) {
                throw new UsernameTakenException(trimmed);
            }

            throw;
        }

        return user;
    }


    public async Task<bool> ChangePasswordAsync(Guid id, string currentPassword, string newPassword, CancellationToken cancellationToken = default) {
        var user = await FindByIdAsync(id, cancellationToken);
        if (user == null || !_hasher.Verify(currentPassword, user.PasswordHash)) {
            return false;
        }

        user.PasswordHash = _hasher.Hash(newPassword);
        await _db.SaveChangesAsync(cancellationToken);
        return true;
    }


    public async Task<UserRecord?> UpdateProfileAsync(Guid id, string? displayName, CancellationToken cancellationToken = default) {
        var user = await FindByIdAsync(id, cancellationToken);
        if (user == null) {
            return null;
        }

        user.DisplayName = string.IsNullOrWhiteSpace(displayName) ? null : displayName.Trim();
        await _db.SaveChangesAsync(cancellationToken);
        return user;
    }
}
