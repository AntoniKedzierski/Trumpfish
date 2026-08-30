using System.Security.Cryptography;

namespace Trumpfish.Server.Services;

/// <summary>
/// PBKDF2-HMAC-SHA256 hashing built on the framework primitives, so no identity package has to be pulled in for the
/// interim username and password scheme. Hashes are self describing (<c>pbkdf2-sha256$iterations$salt$hash</c>), which lets the
/// cost factor be raised later without invalidating existing accounts.
/// </summary>
public sealed class Pbkdf2PasswordHasher : IPasswordHasher {

    private const string Prefix = "pbkdf2-sha256";
    private const int SaltBytes = 16;
    private const int HashBytes = 32;

    /// <summary>OWASP's current floor for PBKDF2-HMAC-SHA256. Raising this only affects new and re-hashed passwords.</summary>
    private const int Iterations = 210_000;


    public string Hash(string password) {
        var salt = RandomNumberGenerator.GetBytes(SaltBytes);
        var hash = Derive(password, salt, Iterations);

        return $"{Prefix}${Iterations}${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }


    public bool Verify(string password, string hash) {
        if (!TryParse(hash, out var iterations, out var salt, out var expected)) {
            return false;
        }

        return CryptographicOperations.FixedTimeEquals(Derive(password, salt, iterations), expected);
    }


    public bool NeedsRehash(string hash) {
        return !TryParse(hash, out var iterations, out _, out _) || iterations < Iterations;
    }


    private static byte[] Derive(string password, byte[] salt, int iterations) {
        return Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, HashBytes);
    }


    private static bool TryParse(string hash, out int iterations, out byte[] salt, out byte[] expected) {
        iterations = 0;
        salt = [];
        expected = [];

        var parts = hash.Split('$');
        if (parts.Length != 4 || parts[0] != Prefix || !int.TryParse(parts[1], out iterations)) {
            return false;
        }

        try {
            salt = Convert.FromBase64String(parts[2]);
            expected = Convert.FromBase64String(parts[3]);
        }
        catch (FormatException) {
            return false;
        }

        return salt.Length > 0 && expected.Length > 0;
    }
}
