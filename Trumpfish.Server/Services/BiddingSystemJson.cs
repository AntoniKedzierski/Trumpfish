using Model.Bidding.AI;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Trumpfish.Server.Services;

/// <summary>
/// The dialect the server reads a whole bidding system document in, kept identical to what the API itself emits so a document
/// exported by the client can be handed straight back.
/// </summary>
/// <remarks>
/// The converter is what makes it identical. <c>BidType</c> and <c>BidColor</c> carry their own string converter attribute, but
/// <c>BiddingGoal</c> does not, so bare web defaults would fail to read the <c>"None"</c> that documents actually contain.
/// Registering the converter covers every enum in the tree and still accepts numeric values, so blobs written by the previous
/// JSON-column store keep loading.
/// </remarks>
public static class BiddingSystemJson {

    private static readonly JsonSerializerOptions Options = CreateOptions();


    public static BiddingSystem? Deserialize(string json) {
        return JsonSerializer.Deserialize<BiddingSystem>(json, Options);
    }


    private static JsonSerializerOptions CreateOptions() {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web) {
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };

        options.Converters.Add(new JsonStringEnumConverter());
        return options;
    }
}
