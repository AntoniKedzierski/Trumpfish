using Model.Bidding.AI;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Trumpfish.Server.Services;

/// <summary>
/// The one JSON dialect the server uses for a whole bidding system document: seed files, legacy blobs and the client's
/// import and export all speak it, and it is deliberately identical to what the API itself emits.
/// </summary>
/// <remarks>
/// The converter is what makes it identical. <c>BidType</c> and <c>BidColor</c> carry their own string converter attribute, but
/// <c>BiddingGoal</c> does not, so bare web defaults would write it as a number and then fail to read the <c>"None"</c> that every
/// existing seed file contains. Registering the converter here covers every enum in the tree and still accepts numeric values,
/// so blobs written by the previous JSON-column store keep loading.
/// </remarks>
public static class BiddingSystemJson {

    private static readonly JsonSerializerOptions Options = CreateOptions(writeIndented: false);

    /// <summary>Same dialect, formatted for a file a human will read and a developer will commit.</summary>
    private static readonly JsonSerializerOptions FileOptions = CreateOptions(writeIndented: true, newLine: "\n");


    public static BiddingSystem? Deserialize(string json) {
        return JsonSerializer.Deserialize<BiddingSystem>(json, Options);
    }


    public static async Task<BiddingSystem?> ReadFileAsync(string path, CancellationToken cancellationToken = default) {
        await using var stream = File.OpenRead(path);
        return await JsonSerializer.DeserializeAsync<BiddingSystem>(stream, Options, cancellationToken);
    }


    public static Task WriteFileAsync(string path, BiddingSystem system, CancellationToken cancellationToken = default) {
        return File.WriteAllTextAsync(path, JsonSerializer.Serialize(system, FileOptions), cancellationToken);
    }


    private static JsonSerializerOptions CreateOptions(bool writeIndented, string? newLine = null) {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web) {
            WriteIndented = writeIndented,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };

        // The indented writer would otherwise follow the host platform, so the same export would differ between Windows and Linux.
        if (newLine != null) {
            options.NewLine = newLine;
        }

        options.Converters.Add(new JsonStringEnumConverter());
        return options;
    }
}
