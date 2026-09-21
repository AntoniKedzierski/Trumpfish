using Model.Bidding.AI.Eval;
using Model.Bidding.Bids;
using Model.Enums;
using Model.Helpers;

namespace Model.Bidding.AI.Engine;

public partial class BidEngine {

    /// <summary>
    /// Po zakończeniu systemu.
    /// Proponuje partię w konkretny kolor (inwit).
    /// </summary>
    private BidNode? TryInvite(Hand hand, Dictionary<BidNode, TableEvaluation> branches, bool isForced) {
        if (branches.Count == 0) {
            return null;
        }

        var bidCandidates = new List<BidNode>();

        foreach (var branch in branches) {
            // Odzywka partnera już robi grę.
            if (branch.Key.MakesGame()) {
                continue;
            }

            // Informacje o sile połączonych rąk.
            var combinedHand = branch.Value.GetCombinedHandEvaluation(hand);
            var lowerColorBoundries = combinedHand.GetLowerColorBoundries();

            // Raczej z 20PC w parze nic nie pogramy.
            if (!isForced && combinedHand.Points.Lower <= 21) {
                bidCandidates.Add(BidNode.Pass("Brak minimum 22 punktów w parze, nie zgłaszamy inwitu (brak forsingu)."));
                continue;
            }

            // Sprawdzenie kontraktów kolorowych, wymagane są punkty oraz co najmniej 8 kart.
            var longestLowerBoundry = lowerColorBoundries.First();

            if (longestLowerBoundry.Value >= 8) {
                bidCandidates.Add(BidNode.SubmitLowest(
                    Auction,
                    longestLowerBoundry.Key.ToBidColor(),
                    limit: longestLowerBoundry.Key.IsMajor() ? 3 : 4,
                    $"Zaproszenie do gry w kolor mając co najmniej {combinedHand.Points.Lower} PC oraz {longestLowerBoundry.Value} kart."
                ));
                continue;
            }

            // Inwit do BA wymaga punktów, załóżmy że 23.
            if (combinedHand.Points >= 23) {
                bidCandidates.Add(BidNode.SubmitLowest(
                    Auction,
                    BidColor.NoTrump,
                    limit: 2,
                    $"Zaproszenie do gry w bez atu mając co najmniej {combinedHand.Points.Lower} PC."
                ));
            }
        }

        // Tylko konstruktywne odzywki, bierzemy najniższą (preferencja BA w przypadku niepewności wynikającej z wielu gałęzi).
        return bidCandidates
            .OrderByDescending(e => e.Color)
            .ThenByDescending(e => e.Value)
            .FirstOrDefault();
    }


    /// <summary>
    /// Po zakończeniu systemu.
    /// Wybiera partię na podstawie siły połączonych rąk. Jeżeli żadna partia nie jest pewna na 100% to zwraca NULL.
    /// Preferujemy grę BA, potem kolory starsze, potem młodsze.
    /// </summary>
    private BidNode? TrySelectContract(Hand hand, Dictionary<BidNode, TableEvaluation> branches, bool isForced, BidColor? inviteColor = null) {
        if (branches.Count == 0) {
            return null;
        }

        var bidCandidates = new List<BidNode>();

        foreach (var branch in branches) {
            // Odzywka partnera już robi grę.
            if (branch.Key.MakesGame()) {
                continue;
            }

            // Informacje o sile połączonych rąk.
            var combinedHand = branch.Value.GetCombinedHandEvaluation(hand);
            var lowerColorBoundries = combinedHand.GetLowerColorBoundries();

            // Raczej z 20PC w parze nic nie pogramy.
            if (!isForced && combinedHand.Points <= 20) {
                bidCandidates.Add(BidNode.Pass("Brak 20 punktów w parze, nie zgłaszamy gry (brak forsingu)."));
                continue;
            }

            // Odpowiedź na inwit BA.
            if (inviteColor == BidColor.NoTrump) {
                if (isForced) {
                    bidCandidates.Add(BidNode.SubmitLowestLegalGameOrDouble(
                        Auction,
                        BidColor.NoTrump,
                        $"Akceptacja inwitu do gry w bez atu mając co najmniej {combinedHand.Points.Lower} PC (sforsowana)."
                    ));
                }
                else if (combinedHand.Points >= 25) {
                    bidCandidates.Add(BidNode.SubmitLowestLegalGameOrDouble(
                        Auction,
                        BidColor.NoTrump,
                        $"Akceptacja inwitu do gry w bez atu mając co najmniej {combinedHand.Points.Lower} PC."
                    ));
                }
                else {
                    bidCandidates.Add(BidNode.Pass("Brak punktów na przyjęcie inwitu bez atu."));
                }
                continue;
            }

            // Preferujemy odpowiedź na inwit, o ile spełnione są założenia gry.
            // Mamy tutaj troszkę niższe limity.
            if (inviteColor != null) {
                var inviteLowerBoundry = lowerColorBoundries.First(e => e.Key.ToBidColor() == inviteColor);

                // Preferencja kolorów starszych.
                if (inviteLowerBoundry.Key.IsMajor() && combinedHand.GoodToPlayColor(inviteLowerBoundry.Key)) {
                    bidCandidates.Add(BidNode.SubmitLowestLegalGameOrDouble(
                        Auction,
                        inviteLowerBoundry.Key.ToBidColor(),
                        $"Akceptacja inwitu do gry w kolor starszy mając co najmniej {combinedHand.Points.Lower} PC oraz {inviteLowerBoundry.Value} kart."
                    ));
                    continue;
                }
                // Dopiero potem młodsze.
                else if (!inviteLowerBoundry.Key.IsMajor() && combinedHand.GoodToPlayColor(inviteLowerBoundry.Key)) {
                    bidCandidates.Add(BidNode.SubmitLowestLegalGameOrDouble(
                        Auction,
                        inviteLowerBoundry.Key.ToBidColor(),
                        $"Akceptacja inwitu do gry w kolor młodszy mając co najmniej {combinedHand.Points.Lower} PC oraz {inviteLowerBoundry.Value} kart."
                    ));
                    continue;
                }
            }

            // Sprawdzenie kontraktów kolorowych, wymagane są punkty oraz co najmniej 8 kart.
            var longestLowerBoundry = lowerColorBoundries.First();

            // Preferencja kolorów starszych.
            if (combinedHand.GoodToPlayColor(longestLowerBoundry.Key)) {
                bidCandidates.Add(BidNode.SubmitLowestLegalGameOrDouble(
                    Auction,
                    longestLowerBoundry.Key.ToBidColor(),
                    $"Zgłoszenie gry w kolor mając co najmniej {combinedHand.Points.Lower} PC oraz {longestLowerBoundry.Value} kart."
                ));
                continue;
            }

            // Jeżeli mamy 25 PC i nie mamy żadnego koloru 8-kartowego na 100%, to zgłaszamy bez atu.
            if (longestLowerBoundry.Value < 8 && combinedHand.Points >= 25) {
                bidCandidates.Add(BidNode.SubmitLowestLegalGameOrDouble(
                    Auction,
                    BidColor.NoTrump,
                    $"Zgłoszenie gry w bez atu mając co najmniej {combinedHand.Points.Lower} PC oraz brak 8-kartowego koloru."
                ));
                continue;
            }

            // Dalszy kod zawiera obniżone limity.
            if (!isForced) {
                bidCandidates.Add(BidNode.Pass("Brak punktów na grę kolorową oraz na grę bez atu."));
                continue;
            }

            // Zgłoszenie najlepszego koloru na GF.
            bidCandidates.Add(BidNode.SubmitLowestLegalGameOrDouble(
                Auction,
                longestLowerBoundry.Key.ToBidColor(),
                $"Zgłoszenie gry w kolor mając co najmniej {combinedHand.Points.Lower} PC oraz {longestLowerBoundry.Value} kart (sforsowane)."
            ));
        }

        // BidCandidates może zawierać passy i odzywki (powinny być identyczne, ale mogą się różnić).
        // Jeżeli jakakolwiek gałąź zgłosiła pass, to zwracamy NULL, żeby spróbować innych metod.
        if (bidCandidates.Any(e => e.Type == BidType.Pass)) {
            return null;
        }

        // Tylko konstruktywne odzywki, bierzemy najniższą (preferencja BA w przypadku niepewności wynikającej z wielu gałęzi).
        return bidCandidates
            .OrderByDescending(e => e.Color)
            .ThenByDescending(e => e.Value)
            .FirstOrDefault();
    }

}