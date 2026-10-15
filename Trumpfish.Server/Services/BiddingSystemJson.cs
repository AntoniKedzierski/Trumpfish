using Model.Bidding.AI;
using Model.Bidding.Bids;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.Json.Serialization.Metadata;

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
        options.TypeInfoResolver = new DefaultJsonTypeInfoResolver {
            Modifiers = { SkipEmptyInterjections }
        };
        return options;
    }


    /// <summary>
    /// An empty interjection list is left out: only a handful of bids have interjections, so in every other one it would be noise.
    /// Reading a node without the field keeps the empty list from the <see cref="BidNode.Interjections"/> initializer.
    /// </summary>
    private static void SkipEmptyInterjections(JsonTypeInfo typeInfo) {
        if (typeInfo.Type != typeof(BidNode)) {
            return;
        }

        var name = JsonNamingPolicy.CamelCase.ConvertName(nameof(BidNode.Interjections));
        var property = typeInfo.Properties.Single(property => property.Name == name);
        property.ShouldSerialize = (_, value) => value is List<Bid> { Count: > 0 };
    }
}
