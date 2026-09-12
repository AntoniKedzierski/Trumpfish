using Microsoft.AspNetCore.DataProtection;
using Model;
using Model.Bidding.AI;
using Model.Enums;
using System.Text.Json;
using Trumpfish.Server.Contracts;

namespace Trumpfish.Server.Services;

/// <summary>
/// Sits the human down at a table with three bots. Nothing is kept on the server: every request rebuilds the deal from the
/// opaque state the client carries, replays the auction through <see cref="TableEngine"/> and stops as soon as it is the
/// human turn again.
/// </summary>
public class PracticeService : IPracticeService {

    /// <summary>The human always sits South, so the table is drawn the same way every time.</summary>
    private const PlayerPosition HumanSeat = PlayerPosition.South;

    private static readonly JsonSerializerOptions StateJson = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    private readonly IDataProtector _protector;


    public PracticeService(IDataProtectionProvider protection) {
        // Signed rather than merely encoded: the hands the client must not see yet travel through it, and so does the deal it
        // will be graded on. A client cannot read them out and cannot hand back a deal it made up.
        _protector = protection.CreateProtector("Trumpfish.Practice.v1");
    }


    public PracticeResult Start(BiddingSystem system, PracticeStartRequest request) {
        var opening = TableEngine.FindOpening(system, request.OpeningNodeId);
        if (request.OpeningNodeId != null && opening == null) {
            return new PracticeResult(null, "Nie znaleziono ćwiczonego otwarcia w tym systemie.");
        }

        // Practising as the responder means the partner is the one who has to be able to open, so the hand goes to him instead.
        var targetSeat = request.Role == PracticeRole.Responder ? PlayerPosition.North : HumanSeat;
        var hands = PracticeDealer.Deal(TableEngine.RandomFor(request.Seed, request.DealIndex), opening, targetSeat);

        if (hands == null) {
            return new PracticeResult(null, "Nie da się rozdać ręki spełniającej warunki tego otwarcia - sprawdź zakresy punktów i kart.");
        }

        var data = new PracticeStateData(
            request.SystemId,
            request.DealIndex,
            // Every deal is started by the next player round the table, so the human bids from a different position each time.
            (PlayerPosition)(((request.DealIndex % 4) + 4) % 4),
            HumanSeat,
            request.OpeningNodeId,
            request.CheckBids,
            [.. Enum.GetValues<PlayerPosition>().Select(position => CardCodec.Encode(hands[position].Cards))],
            []);

        return new PracticeResult(Describe(system, data), null);
    }


    public PracticeStateData? Restore(string state) {
        if (string.IsNullOrWhiteSpace(state)) {
            return null;
        }

        try {
            return JsonSerializer.Deserialize<PracticeStateData>(_protector.Unprotect(state), StateJson);
        }
        catch (Exception) {
            // A state that no longer unprotects is one from an older key or a tampered one; either way there is no deal to resume.
            return null;
        }
    }


    public PracticeResult Bid(BiddingSystem system, PracticeStateData data, PracticeStoredBid bid) {
        var current = Replay(system, data);

        if (current.Finished) {
            return new PracticeResult(null, "Licytacja tego rozdania jest już zakończona.");
        }

        if (current.Waiting != data.Player) {
            return new PracticeResult(null, "To nie jest teraz twoja kolej.");
        }

        if (!PracticeRules.IsLegal(current.Auction, TableEngine.ToBid(bid))) {
            return new PracticeResult(null, "Ta odzywka jest nielegalna w tym miejscu licytacji.");
        }

        return new PracticeResult(Describe(system, data with { Bids = [.. data.Bids, bid] }), null);
    }


    public PracticeHint? Hint(BiddingSystem system, PracticeStateData data) {
        var current = Replay(system, data);
        if (current.Waiting != data.Player) {
            return null;
        }

        var advice = current.Advice;
        return advice == null ? new PracticeHint(null, null) : new PracticeHint(TableEngine.Label(advice), advice.Explanation);
    }


    private TableReplay Replay(BiddingSystem system, PracticeStateData data) {
        return TableEngine.Replay(system, Decode(data), data.Dealer, [data.Player], data.Bids, data.CheckBids, data.DealIndex);
    }


    /// <summary>The table as the client should see it, with the state to hand straight back with the next bid.</summary>
    private PracticeState Describe(BiddingSystem system, PracticeStateData data) {
        var replay = Replay(system, data);

        return new PracticeState(
            _protector.Protect(JsonSerializer.Serialize(data, StateJson)),
            data.DealIndex,
            data.Dealer,
            data.Player,
            AuctionMapping.MapHand(data.Player, replay.Hands[data.Player]),
            replay.Bidding,
            replay.WarningsFor(data.Player),
            replay.Waiting == data.Player,
            replay.Legal,
            replay.Finished,
            replay.Finished ? TableEngine.Result(replay, data.DealIndex, data.Dealer) : null,
            replay.Error);
    }


    private static Dictionary<PlayerPosition, Hand> Decode(PracticeStateData data) {
        return Enum.GetValues<PlayerPosition>()
            .ToDictionary(position => position, position => new Hand(CardCodec.Decode(data.Hands[(int)position]) ?? throw new InvalidOperationException("Uszkodzony stan rozdania.")));
    }
}
