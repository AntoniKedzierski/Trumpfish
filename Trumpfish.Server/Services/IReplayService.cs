using Model.Bidding.AI;
using Model.Enums;
using Trumpfish.Server.Contracts;

namespace Trumpfish.Server.Services;

/// <summary>Wynik komendy powtarzanej licytacji: albo nowy stan stołu, albo powód odmowy.</summary>
public record ReplayResult(ReplayState? State, string? Problem);

/// <summary>
/// Wszystko, co niesie stan powtarzanej licytacji, w drodze do klienta i z powrotem jako jeden podpisany napis.
/// </summary>
/// <remarks>
/// Trzymane są tylko odzywki człowieka: silnik jest deterministyczny, więc odtworzenie licytacji od początku odtwarza
/// odzywki botów co do jednej, a stan zostaje krótki niezależnie od tego, jak długo licytacja trwała.
/// </remarks>
public record ReplayStateData(
    Guid SystemId,
    PlayerPosition Dealer,
    Vulnerability Vulnerability,
    PlayerPosition Player,
    IReadOnlyList<string> Hands,
    IReadOnlyList<PracticeStoredBid> Bids);

/// <summary>Licytowanie gotowego rozdania: człowiek na jednym miejscu, boty na trzech pozostałych.</summary>
public interface IReplayService {

    /// <summary>Sadza człowieka na wybranym miejscu i pozwala botom licytować aż do jego pierwszej kolejki.</summary>
    ReplayResult Start(BiddingSystem system, ReplayStartRequest request);

    /// <summary>Odczytuje nieprzejrzysty stan oddany przez klienta. Null, gdy go nie ma, został podmieniony albo już nie daje się odczytać.</summary>
    ReplayStateData? Restore(string state);

    /// <summary>Dokłada odzywkę człowieka i pozwala botom odpowiedzieć, aż do jego następnej kolejki albo do końca licytacji.</summary>
    ReplayResult Bid(BiddingSystem system, ReplayStateData data, PracticeStoredBid bid);
}
