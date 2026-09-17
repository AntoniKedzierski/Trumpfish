using Model.Enums;

namespace Trumpfish.Server.Contracts;

/// <summary>
/// Rozdanie oddane do ponownego wylicytowania: gotowe karty, rozdający, stan po partii i miejsce, z którego licytuje
/// człowiek. Pozostałe trzy miejsca licytują boty wskazanym systemem.
/// </summary>
/// <remarks>
/// Osobne od ćwiczenia z botami, chociaż licytuje ten sam silnik: tam rozdaje serwer pod ćwiczone otwarcie i mówi, co
/// odzywka obiecywała, tu karty przychodzą z zapisanego rozdania i nie ma żadnej nauki - jest samo licytowanie.
/// </remarks>
public record ReplayStartRequest(Guid SystemId, PlayerPosition Dealer, Vulnerability Vulnerability, PlayerPosition Player, IReadOnlyList<SimulationHandRequest> Hands);

/// <summary>Jedna odzywka człowieka, przeciwko nieprzejrzystemu stanowi wydanemu z poprzednią odpowiedzią.</summary>
public record ReplayBidRequest(string State, BidType Type, BidColor Color, int? Value);

/// <summary>
/// Gdzie stoi powtarzana licytacja. <paramref name="State"/> jest podpisany i nieprzejrzysty: niesie karty, których klient
/// nie może jeszcze zobaczyć, i wraca nietknięty z następną odzywką. <paramref name="Result"/> przychodzi dopiero po
/// zakończeniu licytacji i jest tego samego kształtu, co wynik symulacji - to on odsłania wszystkie cztery ręce.
/// </summary>
public record ReplayState(
    string State,
    PlayerPosition Dealer,
    Vulnerability Vulnerability,
    PlayerPosition Player,
    SimulationHand PlayerHand,
    IReadOnlyList<SimulationBid> Bidding,
    bool PlayerToBid,
    PracticeLegalBids Legal,
    bool Finished,
    SimulationDealResult? Result,
    string? Error);
