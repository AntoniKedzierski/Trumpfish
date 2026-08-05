using Microsoft.EntityFrameworkCore;

namespace Trumpfish.Server.Data;

public class TrumpfishDbContext : DbContext {

    public TrumpfishDbContext(DbContextOptions<TrumpfishDbContext> options) : base(options) {
    }


    public DbSet<BiddingSystemRecord> BiddingSystems => Set<BiddingSystemRecord>();


    protected override void OnModelCreating(ModelBuilder modelBuilder) {
        modelBuilder.Entity<BiddingSystemRecord>(entity => {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Name).IsUnique();
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Json).IsRequired();
        });
    }
}
