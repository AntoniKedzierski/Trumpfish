namespace Trumpfish.Server.Services;

/// <summary>
/// Hashes and verifies account passwords. Kept behind an interface because the current scheme is deliberately a placeholder:
/// swapping it for an external identity provider should not reach past this abstraction.
/// </summary>
public interface IPasswordHasher {

    string Hash(string password);

    /// <summary>Returns whether <paramref name="password"/> matches <paramref name="hash"/>, in constant time for equal length inputs.</summary>
    bool Verify(string password, string hash);

    /// <summary>Whether <paramref name="hash"/> was produced with outdated parameters and should be rewritten on the next successful sign in.</summary>
    bool NeedsRehash(string hash);
}
