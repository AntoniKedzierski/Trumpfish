using Microsoft.EntityFrameworkCore;

namespace Trumpfish.Server.Data;

public class TrumpfishDbContext : DbContext {

    public TrumpfishDbContext(DbContextOptions<TrumpfishDbContext> options) : base(options) {
    }


    public DbSet<UserRecord> Users => Set<UserRecord>();

    public DbSet<BiddingSystemRecord> BiddingSystems => Set<BiddingSystemRecord>();

    public DbSet<BiddingRootRecord> BiddingRoots => Set<BiddingRootRecord>();

    public DbSet<BidNodeRecord> BidNodes => Set<BidNodeRecord>();


    protected override void OnModelCreating(ModelBuilder modelBuilder) {
        modelBuilder.Entity<UserRecord>(entity => {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.NormalizedUsername).IsUnique();
            entity.Property(e => e.Username).IsRequired().HasMaxLength(64);
            entity.Property(e => e.NormalizedUsername).IsRequired().HasMaxLength(64);
            entity.Property(e => e.PasswordHash).IsRequired().HasMaxLength(512);
            entity.Property(e => e.DisplayName).HasMaxLength(128);
        });

        modelBuilder.Entity<BiddingSystemRecord>(entity => {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);

            // Names only have to be unique per owner: two accounts may each keep their own "Wspólny Język".
            var name = entity.HasIndex(e => new { e.OwnerId, e.Name }).IsUnique();

            // Seeds share a null owner, so the nulls have to compare equal for that same index to keep seed names unique among
            // themselves. Only PostgreSQL can express it; the development database relies on the store's own name check instead.
            if (Database.IsNpgsql()) {
                name.AreNullsDistinct(false);
            }

            entity.HasIndex(e => e.IsSeed);
            entity.HasIndex(e => e.ForkedFromId);

            entity.HasOne(e => e.Owner).WithMany(e => e.BiddingSystems).HasForeignKey(e => e.OwnerId).OnDelete(DeleteBehavior.Cascade);

            // Deleting a seed must not take its forks with it: the fork is the user's own work and simply loses its ancestry.
            entity.HasOne(e => e.ForkedFrom).WithMany(e => e.Forks).HasForeignKey(e => e.ForkedFromId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<BiddingRootRecord>(entity => {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.BiddingSystemId);
            entity.Property(e => e.Name).HasMaxLength(200);

            entity.HasOne(e => e.BiddingSystem).WithMany(e => e.Roots).HasForeignKey(e => e.BiddingSystemId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<BidNodeRecord>(entity => {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.RootId);
            entity.HasIndex(e => e.ParentId);

            // The domain identity has to stay addressable, and unique within the branch it lives in. The mapper enforces the
            // stricter per-system rule when it writes, so this index guards the invariant without ever rejecting a real save.
            entity.HasIndex(e => new { e.RootId, e.NodeId }).IsUnique();

            entity.Property(e => e.ColorDistribution).HasMaxLength(200);
            entity.Property(e => e.Convention).HasMaxLength(400);
            entity.Property(e => e.AiSource).HasMaxLength(400);

            // Enums are stored by name so the tables stay readable and a reordered enum cannot silently reinterpret existing rows.
            entity.Property(e => e.Type).HasConversion<string>().HasMaxLength(16);
            entity.Property(e => e.Color).HasConversion<string>().HasMaxLength(16);
            entity.Property(e => e.RealizedGoal).HasConversion<string>().HasMaxLength(16);
            entity.Property(e => e.InterjectionType).HasConversion<string>().HasMaxLength(16);
            entity.Property(e => e.InterjectionColor).HasConversion<string>().HasMaxLength(16);

            entity.HasOne(e => e.Root).WithMany(e => e.Bids).HasForeignKey(e => e.RootId).OnDelete(DeleteBehavior.Cascade);

            // The root already cascades to every node in the tree; letting the self reference cascade as well would give
            // PostgreSQL two delete paths to the same rows, so the parent link is cleaned up by that single cascade instead.
            entity.HasOne(e => e.Parent).WithMany(e => e.Children).HasForeignKey(e => e.ParentId).OnDelete(DeleteBehavior.NoAction);
        });
    }
}
