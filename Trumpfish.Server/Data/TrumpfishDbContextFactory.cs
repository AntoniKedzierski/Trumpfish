using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Trumpfish.Server.Data;

/// <summary>
/// Used by <c>dotnet ef</c> only. Building the real host would demand a configured connection string and would run the startup
/// initializer, so migrations are scaffolded against a context that merely knows it targets PostgreSQL.
/// </summary>
public class TrumpfishDbContextFactory : IDesignTimeDbContextFactory<TrumpfishDbContext> {

    public TrumpfishDbContext CreateDbContext(string[] args) {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__Trumpfish") ?? "Host=localhost;Port=5432;Database=trumpfish;Username=postgres;Password=postgres";
        var options = new DbContextOptionsBuilder<TrumpfishDbContext>().UseNpgsql(connectionString).Options;

        return new TrumpfishDbContext(options);
    }
}
