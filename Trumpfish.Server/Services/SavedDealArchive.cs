#if DEBUG
using Microsoft.EntityFrameworkCore;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Text.Json.Serialization;
using Trumpfish.Server.Data;

namespace Trumpfish.Server.Services;

/// <summary>
/// The Debug-only implementation. The whole file is compiled out of a Release build, so a deployed server carries no code
/// that reads or writes deals on disk - see <see cref="DisabledSavedDealArchive"/> for what stands in its place.
/// </summary>
public sealed class SavedDealArchive : ISavedDealArchive {

    /// <summary>One file per deal, named by its id: nothing to merge, and a file can be deleted by hand without consequence.</summary>
    private static readonly JsonSerializerOptions FileJson = new(JsonSerializerDefaults.Web) {
        WriteIndented = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    private readonly TrumpfishDbContext _db;
    private readonly ILogger<SavedDealArchive> _logger;


    public SavedDealArchive(TrumpfishDbContext db, ILogger<SavedDealArchive> logger) {
        _db = db;
        _logger = logger;
    }


    /// <summary>Only while the database itself is throwaway. Against a real one the database is the archive.</summary>
    public bool IsAvailable => !_db.Database.IsNpgsql() && Directory() != null;


    public async Task KeepAsync(SavedDealRecord record, CancellationToken cancellationToken = default) {
        var directory = Directory();
        if (!IsAvailable || directory == null) {
            return;
        }

        try {
            var owner = await _db.Users.Where(user => user.Id == record.OwnerId).Select(user => user.Username).FirstOrDefaultAsync(cancellationToken);
            System.IO.Directory.CreateDirectory(directory);

            var archived = new ArchivedDeal(
                record.Id,
                owner ?? string.Empty,
                record.Name,
                record.Tags,
                record.Comment,
                record.Contract,
                record.Dealer,
                record.Vulnerability,
                record.SavedUtc,
                JsonDocument.Parse(record.Deal).RootElement);

            await File.WriteAllTextAsync(Path.Combine(directory, $"{record.Id}.json"), JsonSerializer.Serialize(archived, FileJson), cancellationToken);
        }
        catch (Exception reason) {
            // The deal is already in the database; the copy on disk is a convenience and must never take the save down with it.
            _logger.LogWarning(reason, "Nie udało się zapisać rozdania {Id} do katalogu lokalnego.", record.Id);
        }
    }


    public Task ForgetAsync(Guid id, CancellationToken cancellationToken = default) {
        var directory = Directory();
        if (!IsAvailable || directory == null) {
            return Task.CompletedTask;
        }

        try {
            File.Delete(Path.Combine(directory, $"{id}.json"));
        }
        catch (Exception reason) {
            _logger.LogWarning(reason, "Nie udało się usunąć lokalnego pliku rozdania {Id}.", id);
        }

        return Task.CompletedTask;
    }


    public async Task<IReadOnlyList<SavedDealRecord>> RestoreAsync(IReadOnlyDictionary<string, Guid> usersByName, CancellationToken cancellationToken = default) {
        var directory = Directory();
        if (!IsAvailable || directory == null || !System.IO.Directory.Exists(directory)) {
            return [];
        }

        var restored = new List<SavedDealRecord>();

        foreach (var path in System.IO.Directory.EnumerateFiles(directory, "*.json")) {
            try {
                var archived = JsonSerializer.Deserialize<ArchivedDeal>(await File.ReadAllTextAsync(path, cancellationToken), FileJson);

                // A deal kept by an account this database has never heard of has nowhere to go back to, so it is left alone.
                if (archived == null || !usersByName.TryGetValue(archived.Owner, out var ownerId)) {
                    continue;
                }

                restored.Add(new SavedDealRecord {
                    Id = archived.Id,
                    OwnerId = ownerId,
                    Name = archived.Name,
                    Tags = archived.Tags,
                    Comment = archived.Comment,
                    Contract = archived.Contract,
                    Dealer = archived.Dealer,
                    Vulnerability = archived.Vulnerability,
                    SavedUtc = archived.SavedUtc,
                    Deal = archived.Deal.GetRawText(),
                });
            }
            catch (Exception reason) {
                _logger.LogWarning(reason, "Pominięto nieczytelny plik zapisanego rozdania: {Path}", path);
            }
        }

        return restored;
    }


    /// <summary>
    /// Beside the project rather than inside <c>Seed</c>: seeds are content the build copies and a deployment ships, and
    /// these are neither. Derived from the path the compiler embedded for this file, so it lands in the working copy
    /// whether the server was started by the SDK or from its build output.
    /// </summary>
    private static string? Directory([CallerFilePath] string sourcePath = "") {
        var project = Path.GetDirectoryName(Path.GetDirectoryName(sourcePath));
        return project == null || !System.IO.Directory.Exists(project) ? null : Path.Combine(project, "LocalDeals");
    }


    private record ArchivedDeal(
        Guid Id,
        string Owner,
        string Name,
        string Tags,
        string? Comment,
        string Contract,
        Model.Enums.PlayerPosition Dealer,
        Model.Enums.Vulnerability Vulnerability,
        DateTimeOffset SavedUtc,
        JsonElement Deal);
}
#endif
