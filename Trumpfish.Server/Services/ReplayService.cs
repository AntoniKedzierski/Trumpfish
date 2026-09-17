using Microsoft.AspNetCore.DataProtection;
using Model;
using Model.Bidding.AI;
using Model.Enums;
using System.Text.Json;
using Trumpfish.Server.Contracts;

namespace Trumpfish.Server.Services;

/// <summary>
/// Sadza człowieka przy gotowym rozdaniu i pozwala mu wylicytować je od nowa przeciwko trzem botom.
/// </summary>
/// <remarks>
/// Serwer nie trzyma nic: każde żądanie odtwarza licytację od początku z nieprzejrzystego stanu, który nosi klient, i
/// zatrzymuje się, gdy znowu przychodzi kolej człowieka. Licytuje ten sam <see cref="TableEngine"/>, co ćwiczenie z
/// botami, ale bez niczego, co ćwiczenie dokłada: nie ma podpowiedzi, sprawdzania odzywek ani ostrzeżeń.
/// </remarks>
public class ReplayService : IReplayService {

    private static readonly JsonSerializerOptions StateJson = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    private readonly IDataProtector _protector;


    public ReplayService(IDataProtectionProvider protection) {
        // Podpisany, a nie tylko zakodowany: przez stan przechodzą trzy ręce, których klient nie ma prawa jeszcze zobaczyć.
        _protector = protection.CreateProtector("Trumpfish.Replay.v1");
    }


    public ReplayResult Start(BiddingSystem system, ReplayStartRequest request) {
        var hands = Build(request.Hands);
        if (hands == null) {
            return new ReplayResult(null, "Rozdanie jest niekompletne - potrzeba czterech rąk po trzynaście różnych kart.");
        }

        var data = new ReplayStateData(
            request.SystemId,
            request.Dealer,
            request.Vulnerability,
            request.Player,
            [.. Enum.GetValues<PlayerPosition>().Select(position => CardCodec.Encode(hands[position].Cards))],
            []);

        return new ReplayResult(Describe(system, data), null);
    }


    public ReplayStateData? Restore(string state) {
        if (string.IsNullOrWhiteSpace(state)) {
            return null;
        }

        try {
            return JsonSerializer.Deserialize<ReplayStateData>(_protector.Unprotect(state), StateJson);
        }
        catch (Exception) {
            // Stan, który już się nie odpakowuje, jest z innego klucza albo podmieniony; tak czy inaczej nie ma czego wznawiać.
            return null;
        }
    }


    public ReplayResult Bid(BiddingSystem system, ReplayStateData data, PracticeStoredBid bid) {
        var current = Replay(system, data);

        if (current.Finished) {
            return new ReplayResult(null, "Licytacja tego rozdania jest już zakończona.");
        }

        if (current.Waiting != data.Player) {
            return new ReplayResult(null, "To nie jest teraz twoja kolej.");
        }

        if (!PracticeRules.IsLegal(current.Auction, TableEngine.ToBid(bid))) {
            return new ReplayResult(null, "Ta odzywka jest nielegalna w tym miejscu licytacji.");
        }

        return new ReplayResult(Describe(system, data with { Bids = [.. data.Bids, bid] }), null);
    }


    private TableReplay Replay(BiddingSystem system, ReplayStateData data) {
        // Numer rozdania służy silnikowi za rozdanie w sesji; powtórka jest zawsze pojedyncza, więc jest nim zero.
        return TableEngine.Replay(system, Decode(data), data.Dealer, [data.Player], data.Bids, false, 0);
    }


    /// <summary>Stół tak, jak ma go zobaczyć klient, razem ze stanem do oddania z następną odzywką.</summary>
    private ReplayState Describe(BiddingSystem system, ReplayStateData data) {
        var replay = Replay(system, data);

        return new ReplayState(
            _protector.Protect(JsonSerializer.Serialize(data, StateJson)),
            data.Dealer,
            data.Vulnerability,
            data.Player,
            AuctionMapping.MapHand(data.Player, replay.Hands[data.Player]),
            replay.Bidding,
            replay.Waiting == data.Player,
            replay.Legal,
            replay.Finished,
            replay.Finished ? TableEngine.Result(replay, 0, data.Dealer) : null,
            replay.Error);
    }


    /// <summary>Cztery ręce po trzynaście kart i żadnej karty dwa razy - inaczej nie ma czego licytować.</summary>
    private static Dictionary<PlayerPosition, Hand>? Build(IReadOnlyList<SimulationHandRequest> hands) {
        if (hands.Count != 4
            || hands.Select(hand => hand.Position).Distinct().Count() != 4
            || hands.Any(hand => hand.Cards.Count != 13)
            || hands.SelectMany(hand => hand.Cards).Select(card => (card.Value, card.Color)).Distinct().Count() != 52) {
            return null;
        }

        return hands.ToDictionary(hand => hand.Position, hand => new Hand(hand.Cards.Select(card => new Card(card.Value, card.Color))));
    }


    private static Dictionary<PlayerPosition, Hand> Decode(ReplayStateData data) {
        return Enum.GetValues<PlayerPosition>()
            .ToDictionary(position => position, position => new Hand(CardCodec.Decode(data.Hands[(int)position]) ?? throw new InvalidOperationException("Uszkodzony stan rozdania.")));
    }
}
