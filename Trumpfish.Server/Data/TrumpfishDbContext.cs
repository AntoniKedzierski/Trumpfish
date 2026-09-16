using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Trumpfish.Server.Data;

public class TrumpfishDbContext : DbContext {

    public TrumpfishDbContext(DbContextOptions<TrumpfishDbContext> options) : base(options) {
    }


    public DbSet<UserRecord> Users => Set<UserRecord>();

    public DbSet<BiddingSystemRecord> BiddingSystems => Set<BiddingSystemRecord>();

    public DbSet<BiddingRootRecord> BiddingRoots => Set<BiddingRootRecord>();

    public DbSet<BidNodeRecord> BidNodes => Set<BidNodeRecord>();

    public DbSet<FriendshipRecord> Friendships => Set<FriendshipRecord>();

    public DbSet<SavedDealRecord> SavedDeals => Set<SavedDealRecord>();

    public DbSet<SavedDealShareRecord> SavedDealShares => Set<SavedDealShareRecord>();


    protected override void OnModelCreating(ModelBuilder modelBuilder) {
        modelBuilder.Entity<UserRecord>(entity => {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.NormalizedUsername).IsUnique();
            entity.Property(e => e.Username).IsRequired().HasMaxLength(64);
            entity.Property(e => e.NormalizedUsername).IsRequired().HasMaxLength(64);
            entity.Property(e => e.PasswordHash).IsRequired().HasMaxLength(512);
            entity.Property(e => e.DisplayName).HasMaxLength(128);
        });

        modelBuilder.Entity<FriendshipRecord>(entity => {
            entity.HasKey(e => e.Id);

            // One row per ordered pair. The reverse pair is rejected by the service, which looks the pair up in both directions
            // before writing - an index cannot express "unordered pair" on its own.
            entity.HasIndex(e => new { e.RequesterId, e.AddresseeId }).IsUnique();
            entity.HasIndex(e => e.AddresseeId);

            entity.Property(e => e.Status).HasConversion<string>().HasMaxLength(16);

            // Only one of the two sides may cascade - PostgreSQL refuses two delete paths into the same table - so deleting an
            // account takes the invitations it sent and leaves the ones it received. Nothing deletes accounts today; whatever
            // eventually does will have to clear the addressee side itself.
            entity.HasOne(e => e.Requester).WithMany().HasForeignKey(e => e.RequesterId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Addressee).WithMany().HasForeignKey(e => e.AddresseeId).OnDelete(DeleteBehavior.NoAction);
        });

        modelBuilder.Entity<SavedDealRecord>(entity => {
            entity.HasKey(e => e.Id);

            // Every read of this table is "my deals, newest first", which is exactly what this index answers.
            entity.HasIndex(e => new { e.OwnerId, e.SavedUtc });

            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Tags).IsRequired().HasMaxLength(500);
            entity.Property(e => e.Comment).HasMaxLength(2000);
            entity.Property(e => e.Contract).IsRequired().HasMaxLength(32);

            // What the contract search asks about, so it is asked of an index rather than of every row.
            entity.HasIndex(e => new { e.OwnerId, e.Level, e.Color });
            entity.Property(e => e.Deal).IsRequired();

            // Stored by name, so the tables stay readable and a reordered enum cannot silently reinterpret existing rows.
            entity.Property(e => e.Dealer).HasConversion<string>().HasMaxLength(16);
            entity.Property(e => e.Vulnerability).HasConversion<string>().HasMaxLength(16);
            entity.Property(e => e.Color).HasConversion<string>().HasMaxLength(16);
            entity.Property(e => e.Declarer).HasConversion<string>().HasMaxLength(16);

            /*
             * SQLite refuses to order by a `DateTimeOffset` at all - it has no such type, and the text it stores one as
             * does not sort as a date. The development database therefore keeps the instant as the binary form, which is
             * a long and sorts the same way the instant does; PostgreSQL keeps its own timestamp and is left alone.
             */
            if (Database.IsSqlite()) {
                entity.Property(e => e.SavedUtc).HasConversion(new DateTimeOffsetToBinaryConverter());
            }

            entity.HasOne(e => e.Owner).WithMany().HasForeignKey(e => e.OwnerId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SavedDealShareRecord>(entity => {
            entity.HasKey(e => e.Id);

            // A deal is shared with somebody once. Sharing it again is the same row, not a second one.
            entity.HasIndex(e => new { e.DealId, e.ToUserId }).IsUnique();
            entity.HasIndex(e => new { e.ToUserId, e.SharedUtc });

            // The deal cascades, the recipient does not: PostgreSQL refuses two delete paths into the same table, and the
            // rule that matters here is that deleting a deal takes every share of it.
            entity.HasOne(e => e.Deal).WithMany(e => e.Shares).HasForeignKey(e => e.DealId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.ToUser).WithMany().HasForeignKey(e => e.ToUserId).OnDelete(DeleteBehavior.NoAction);

            // The same reason as on the deal itself: SQLite cannot order by an offset date.
            if (Database.IsSqlite()) {
                entity.Property(e => e.SharedUtc).HasConversion(new DateTimeOffsetToBinaryConverter());
            }
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
