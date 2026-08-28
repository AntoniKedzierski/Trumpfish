using Model.Bidding.AI.Eval;
using Model.Bidding.Bids;
using Model.Enums;
using Model.Helpers;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection.Metadata.Ecma335;
using System.Text;
using System.Threading.Tasks;

namespace Model.Bidding.AI.Engine;

public partial class BidEngine {

    
    /// <summary>
    /// Odpowiedź w dowolnym momencie, partner niespasował.
    /// </summary>
    private BidNode TrueNaturalResponse(Hand hand, BidNode partnerBidNode, TableEvaluation tableEvaluation) {
        if (partnerBidNode.Type == BidType.Double || partnerBidNode.Type == BidType.Redouble) {
            return BidNode.Pass("Pas na kontrę lub rekontrę partnera.");
        }

        var strongHand = PartnerOpened ? hand.Points >= 10 : hand.Points >= 15;
        var combinedHand = tableEvaluation.GetCombinedHandEvaluation(hand);

        if (combinedHand.Points.Lower < 19) {
            return BidNode.Pass($"Poniżej 19 punków w parze, wyszło że mamy {combinedHand.Points}.");
        }

        var biddedColors = OwnBidsHistory.Select(e => e.Color).ToHashSet();
        var strongestColors = hand.GetStrongestColors();
        var strongestColor = strongestColors.First();
        var longestColor = hand.GetLongestColor();

        // Szukamy fitu z partnerem lub zgłaszamy własny.
        if (biddedColors.Count == 0) {
            // Jeżeli zgłosił BA, to proponujemy własny 5-kartowy kolor na poziomie dwóch.
            if (partnerBidNode.Color == BidColor.NoTrump && hand.CountCards(strongestColor) >= 5) {
                var lowestPossibleValue = Auction.GetLowestLegalValue(strongestColor.ToBidColor());

                // Albo strongHand albo maksymalnie jeden poziom różnicy.
                if (strongHand || lowestPossibleValue - partnerBidNode.Value!.Value == 1) {
                    return BidNode.Submit(lowestPossibleValue, strongestColor, "Pokazanie mocnej ręki lub własnego pięciokartowego koloru bez przeskoku.");
                }

                if (hand.HasEvenDistribution()) {
                    return BidNode.SubmitLowest(Auction, BidColor.NoTrump, explanation: "Zgłoszenie BA z równym rozkładem.");
                }

                if (LastOpponentBid?.AtLevel(3) ?? false) {
                    return BidNode.Double("Kontra karna dla przeciwników próbujących się wcinać na poziomie 3.");
                }

                return BidNode.Pass("Brak poparcia dla BA (słaba karta).");
            }
            else if (partnerBidNode.Color == BidColor.NoTrump) {
                var lowestPossibleValue = Auction.GetLowestLegalValue(BidColor.NoTrump);

                if (LastOpponentBid?.AtLevel(3) ?? false) {
                    return BidNode.Double("Kontra karna dla przeciwników próbujących się wcinać na poziomie 3.");
                }

                if (combinedHand.Points >= 32 && lowestPossibleValue >= 6) {
                    return BidNode.Submit(6, BidColor.NoTrump, $"Zgłoszenie szlemika BA zgodnie z dolnym limitem puntków połączonych rąk: {combinedHand.Points}.");
                }

                if (combinedHand.Points >= 26 && lowestPossibleValue >= 3) {
                    return BidNode.Submit(3, BidColor.NoTrump, $"Zgłoszenie koncówki w BA zgodnie z dolnym limitem punktów połączonych rąk: {combinedHand.Points}.S");
                }

                if (lowestPossibleValue == 2) {
                    return BidNode.Submit(2, BidColor.NoTrump, $"Swobodny inwit BA, wyliczona siła połączonych rąk: {combinedHand.Points}.");
                }

                return BidNode.Pass("Brak poparcia dla BA (brak własnego koloru, słaba karta)");
            }

            // Odpowiedź na 2 trefle.
            if (partnerBidNode.EqualsByColorAndValue(2, BidColor.Clubs)) {
                var lowestPossibleValue = Auction.GetLowestLegalValue(longestColor.ToBidColor());

                if (lowestPossibleValue == 3 || hand.Points <= 6) {
                    return BidNode.Pass("Brak 6 punktów do poparcia odzywki 2 trefl.");
                }

                return BidNode.Submit(lowestPossibleValue, longestColor, $"Poparcie gry w trefle z szacowaną siłą: {combinedHand.Points}.");
            }

            // Partner zgłosił kolor.
            // Fitujemy z partnerem (3+ karty w jego kolorze).
            if (hand.Fits(partnerBidNode.Color)) {
                if (combinedHand.Points >= 24 && partnerBidNode.Color.IsMajor() || combinedHand.Points >= 27 && partnerBidNode.Color.IsMajor()) {
                    var gameMakingBid = BidNode.SubmitGame(partnerBidNode.Color, $"Zgłoszenie gry w kolor (mamy fit) na szacowanym zakresie punktów: {combinedHand.Points}.");
                    if (gameMakingBid.IsBidLegal(Auction)) {
                        return gameMakingBid;
                    }

                    // Zabezpieczenie przed wcinką przeciwników.
                    if (LastOpponentBid != null) {
                        return BidNode.SubmitLowest(
                            Auction,
                            partnerBidNode.Color,
                            explanation: $"Zgłoszenie gry w kolor (mamy fit) na wyższym poziomie niż końcówka, bo nie było innego wyjścia. Szacowany zakres punktów: {combinedHand.Points}."
                        );
                    }

                    return BidNode.Pass($"Pass mimo fitu, zgłoszenie gry na zadanym poziomie jest nielegalne w licytacji. Przeciwnicy coś powiedzieli, dlatego karnie pasujemy z punktami: {combinedHand.Points}.");
                }

                return strongHand 
                    ? BidNode.SubmitLowest(Auction, partnerBidNode.Color, explanation: $"Inwit do dogranej z silną ręką i szacowanymi punktami pary: {combinedHand.Points}.")           // Inwit
                    : BidNode.SubmitWithRaise(Auction, partnerBidNode.Color, explanation: $"Sign-off z powodu słabej ręki, szacowane punkty: {combinedHand.Points}.");       // Sign-off
            }

            // Nie fituje.
            // Powinniśmy wejść swoim kolorem z przeskokiem i pokazać silną rękę.
            if (strongHand) {
                var lowestPossibleValue = Auction.GetLowestLegalValue(strongestColor.ToBidColor());

                // Nowy zgłoszony kolor z przeskokiem ma mieć 5 kart.
                if (hand.CountCards(strongestColor) >= 5) {
                    // Nie wchodzimy nowym kolorem na poziomie czterech!
                    if (lowestPossibleValue >= 3) {
                        return BidNode.Submit(lowestPossibleValue, strongestColor, $"Brak fitu, silna ręka, zgłoszenie własnego pięciokartowego koloru na poziomie maksymalnie 4 (z próbą przeskoku).");
                    }

                    return BidNode.Submit(lowestPossibleValue + 1, strongestColor, $"Brak fitu, silna ręka, zgłoszenie własnego pięciokartowego koloru na poziomie maksymalnie 4.");
                }

                return BidNode.SubmitLowest(Auction, BidColor.NoTrump, explanation: $"Brak fitu, silna ręka, próba ucieczki w BA z silną ręką.");
            }

            // Preferujemy zgłoszenie starszej czwórki na poziomie jeden.
            if (strongestColor.IsMajor() && hand.CountCards(strongestColor) >= 4) {
                var lowestPossibleValue = Auction.GetLowestLegalValue(strongestColor.ToBidColor());
                if (lowestPossibleValue == 1) {
                    return BidNode.Submit(1, strongestColor, "Zgłoszenie starszej czwórki na poziomie 1.");
                }
            }

            // Jeżeli nie mogliśmy zgłosić swojego
            if (hand.HasEvenDistribution()) { 
                var lowestPossibleNoTrump = Auction.GetLowestLegalValue(BidColor.NoTrump);

                // Nie mamy strongHandu, nie wchodzimy na poziom 3. Wtedy preferujemy BA (1 lub 2)
                if (lowestPossibleNoTrump >= 3) {
                    return BidNode.Pass("Słaba ręka, nie zgłaszamy 3BA mimo równego rozkładnu.");
                }

                return BidNode.Submit(lowestPossibleNoTrump, BidColor.NoTrump, "Słaba ręka i równy rozkład.");
            }

            return BidNode.Pass("Brak innych dostępnych opcji na odpowiedź (nic jeszcze nie mówiliśmy).");
        }

        // Dalsza licytacja, partner nam odpowiedział.
        var lastOwnBidColor = LastOwnBid!.Color;

        // Gdy robimy grę, ale mamy punkty na szlemika w parze.
        if (partnerBidNode.MakesGame()) {
            if (combinedHand.Points >= BiddingHelper.SmallSlamPointsRequirement(partnerBidNode.Color)) {
                return BidNode.Submit(6, partnerBidNode.Color, $"Partner zatwierdził grę, ale wychodzi nam siła na szlemika: {combinedHand.Points}.");
            }

            // Kontrujemy
            if (LastRightOpponentBid?.Type == BidType.Submit) {
                return BidNode.SubmitLowestLegalGameOrDouble(Auction, partnerBidNode.Color, $"Partner zatwierdził grę, ale oponenci się wcieli. Kontra karna na punktach w parze: {combinedHand.Points}.");
            }

            return BidNode.Pass("Pas po zatwierdzeniu gry przez partnera.");
        }

        // partnerPoints <= 18 - points (pass na pass), no chyba że kontra karna.
        if (partnerBidNode.Type == BidType.Pass) {
            if (LastOpponentBid?.AtLevel(3) ?? false) {
                return BidNode.Double($"Oponenci się wcieli, kontra karna z punktami: {combinedHand.Points}.");
            }
            return BidNode.Pass("Pas na pas partnera po wtrąceniu przeciwników.");
        }

        // Czy partner mówił coś z przeskokiem?
        var partnerLowestPossibleBid = Auction.GetLowestLegalValue(partnerBidNode.Color, 2);
        var valueDiff = partnerBidNode.Value - partnerBidNode.Value;
        var possibleDiff = partnerBidNode.Value - partnerLowestPossibleBid;
        var partnerRaised = possibleDiff < valueDiff;

        // Mamy fit, nie mamy partii.
        if (lastOwnBidColor == partnerBidNode.Color) {
            // Powiedział minimalnie jak mógł - strongHand i inwit.
            if (!partnerRaised) {
                // Gramy końcówkę lub kontrę.
                return BidNode.SubmitLowestLegalGameOrDouble(Auction, lastOwnBidColor, $"Partner potwierdził kolor bez przeskoku, czyli jest silny. Zgłoszenie końcówki lub kontry z punktami w parze: {combinedHand.Points}.");
            }
            // Powiedział z przeskokiem, gramy partię tylko na dobrej ręce lub kontrujemy oponentów.
            else if (valueDiff == possibleDiff + 1) {
                // StrongHand lub submit w color na 6+ kartach
                if (strongHand || lastOwnBidColor.IsColorGame() && hand.CountCards(lastOwnBidColor.ToCardColor()) >= 7) {
                    return BidNode.SubmitLowestLegalGameOrDouble(Auction, lastOwnBidColor, $"Partner potwierdził kolor z przeskokiem, czyli jest słaby, my jesteśmy silni. Zgłoszenie końcówki lub kontry z punktami w parze: {combinedHand.Points}.");
                }

                // Jeżeli wychodzi gra na podstawie połączonej ręki.
                // 8+ w starszym, 24 PC
                // 8+ w młodszym, 27 PC
                if (lastOwnBidColor.IsColorGame() && combinedHand.GetSuit(lastOwnBidColor.ToCardColor()) >= 8 && combinedHand.Points >= lastOwnBidColor.GamePointsRequirement()) {
                    return BidNode.SubmitLowestLegalGameOrDouble(Auction, lastOwnBidColor, $"Akceptacja gry kolorowej lub kontra karna, na punktach: {combinedHand.Points} i kartach w kolorze: {combinedHand.GetSuit(lastOwnBidColor.ToCardColor())}.");
                }

                // NoTrump - niedostępny na poziomie 3 lub niżej.
                // Pass na wszystko inne.
                return BidNode.Pass("Brak innej dostępnej odzywki po poparciu przez partnera z przeskokiem.");
            }

            // Jakikolwiek większy przeskok.
            // Natychmiastowe zgłoszenie końcówki to sign-off.
            if (partnerBidNode.MakesGame()) {
                // Kontrujemy, gdy przeciwnik się wciął.
                if (LastRightOpponentBid != null) {
                    return BidNode.Double("Partner zrobił większy przeskok, kontra karna.");
                }
                return BidNode.Pass("Partner zrobił większy przeskok, automatyczny pas.");
            }

            // Fallback.
            return BidNode.Pass("Brak innej odzywki po poparciu przez partnera.");
        }

        // Partner zgłosił inny kolor na nasz kolor (nie nasze BA).
        // W naturalnej licytacji wszystki super, ale w systemie nie ma preferencji zgłaszania fitu, np. 12+ PC, 5+ kart w innym kolorze, możliwy fit w kolorze otwarcia!
        if (lastOwnBidColor.IsColorGame() && partnerBidNode.Color.IsColorGame()) {
            // Inny najlepszy kolor
            // Potencjalny problem, partner mógł nie zgłosić fitu od razu, bo system priorytezuje wejście własnym kolorem przy 12+ PC (żeby było GF?)
            var bestFitColor = combinedHand.FindFit(lastOwnBidColor.ToCardColor());

            // One-over-one, słabe wejście, niezobowiązujące.
            if (LastOwnBid.GetLevel() == 1 && partnerBidNode.GetLevel() == 1) {
                // Jeżeli możemy go poprzeć w ten kolor, to próbujemy na najniższym możliwym poziomie, ale nie większym niż 3.
                if (hand.Fits(partnerBidNode.Color)) {
                    return BidNode.SubmitLowest(Auction, partnerBidNode.Color, 3, $"Odpowiedź po one-over-one na misfit kolorowy z partnerem.");
                }

                // Pokazujemy drugi najlepszy kolor, o ile ma conajmniej 4 karty.
                // Maksymalnie na poziomie 2 (weakHand) lub 3 (strongHand).
                var secondBestColor = strongestColors[1];
                if (hand.CountCards(secondBestColor) >= 4) {
                    return BidNode.SubmitLowest(Auction, secondBestColor.ToBidColor(), strongHand ? 3 : 2, $"Pokazanie drugiego najlepszego koloru, poziom 2 - słaba ręka, poziom 3 - mocna ręka.");
                }

                // Sprawdzamy, czy nie wychodzi nam coś z ewaluacji stołu.
                // Pomijamy kolor, który partner zanegował. Możemy go zgłosić maksymalnie na poziomie dwóch.
                // To zwróci BA, jeżeli nie mamy pewnych 8-ek lub 9-ek (młodszy).
                return BidNode.SubmitLowest(Auction, bestFitColor, 2, "Misfity, zgłoszenie najlepszego pasującego koloru (najpewniej BA), z limitem 2.");
            }

            // Two-over-one, bez przeskoku, obiecujące solidną rękę.
            if (LastOwnBid.GetLevel() == 1 && partnerBidNode.GetLevel() == 2 && partnerLowestPossibleBid == partnerBidNode.Value) {
                // Jeżeli możemy go poprzeć w ten kolor, to próbujemy na najniższym możliwym poziomie, ale nie większym niż 4.
                if (hand.Fits(partnerBidNode.Color)) {
                    return BidNode.SubmitLowest(Auction, partnerBidNode.Color, 4, "Wejście po two-over-one z dobrą ręką.");
                }

                // Pokazujemy drugi najlepszy kolor, o ile ma conajmniej 4 karty.
                // Maksymalnie na poziomie 3 (zawsze).
                var secondBestColor = strongestColors[1];
                if (hand.CountCards(secondBestColor) >= 4) {
                    return BidNode.SubmitLowest(Auction, secondBestColor.ToBidColor(), 3, "Pokazanie drugiego najlepszego koloru po two-over-one.");
                }

                // Sprawdzamy, czy nie wychodzi nam coś z ewaluacji stołu.
                // Pomijamy kolor, który partner zanegował. Możemy go zgłosić maksymalnie na poziomie trzech.
                // To zwróci BA, jeżeli nie mamy pewnych 8-ek lub 9-ek (młodszy).
                return BidNode.SubmitLowest(Auction, bestFitColor, 3, "Misfity, zgłoszenie najlepszego pasującego koloru (najpewniej BA), z limitem 3.");
            }

            // Partner zgłosił własny kolor z przeskokiem.
            if (partnerRaised) {
                // Jeżeli możemy go poprzeć w ten kolor, to licytujemy końcówkę lub kontrę na oponentów.
                if (hand.Fits(partnerBidNode.Color)) {
                    return BidNode.SubmitLowestLegalGameOrDouble(Auction, partnerBidNode.Color, $"Partner wszedł z przeskokiem, a my możemy go poprzeć. Kontra karna, na mięso.");
                }

                // Sprawdzamy, czy nie wychodzi nam coś z ewaluacji stołu.
                // Pomijamy kolor, który partner zanegował. Możemy go zgłosić maksymalnie na poziomie trzech.                
                // Jeżeli to BA, to licytujemy grę.
                if (bestFitColor == BidColor.NoTrump) {
                    return BidNode.SubmitLowestLegalGameOrDouble(Auction, BidColor.NoTrump, "Wychodzi nam, że najlepiej pasuje nam branie BA, ewentualnie kontra na mięso.");
                }

                // wpp mamy ograniczenie na poziomie 4.
                return BidNode.SubmitLowest(Auction, bestFitColor, 4, "Pozostałe przypadki po zgłoszeniu koloru z przeskokiem przez partnera.");
            }

            // Wszystkie inne przypadki misfita (poziom powyżej 2), patrzymy na ewaluację stołu.
            // Natychmiastowy pass z plażą.
            if (combinedHand.Points < 24) {
                return BidNode.Pass($"Misfity i poniżej 24 punktów w parze: {combinedHand.Points}.");
            }

            var lowestLegalBestFit = Auction.GetLowestLegalValue(bestFitColor);

            // Na silnej ręce obowiązują wyższe limity.
            return BidNode.SubmitLowest(Auction, bestFitColor, strongHand ? 3 : 2, $"Zgłoszenie najlepszego fitu na kolor partnera.");
        }

        // Partner zgłosił BA na nasz kolor.
        if (lastOwnBidColor.IsColorGame() && partnerBidNode.Color.IsNoTrumpGame()) {
            // Z przeskokiem - partner jest mocny
            if (partnerRaised) {
                // Jeżeli możemy poprzeć jego BA:
                if (hand.HasEvenDistribution() || combinedHand.FitsNoTrumpForSure()) {
                    return BidNode.SubmitLowestLegalGameOrDouble(Auction, BidColor.NoTrump, $"Partner proponuje BA po naszym kolorze, co zgadza się z szacowanymi punktami pary: {combinedHand.Points} i precyzyjnie z układem ręki.");
                }

                // Jeżeli nie jesteśmy pewni to dodatkowo patrzymy na punkty
                if (combinedHand.FitsNoTrump()) {
                    return strongHand
                        ? BidNode.SubmitLowestLegalGameOrDouble(Auction, BidColor.NoTrump, $"Partner proponuje BA po naszym kolorze, co zgadza się z szacowanymi punktami pary: {combinedHand.Points}, ale nie z układem ręki. Na szczęście mamy dużo punktów.")
                        : BidNode.SubmitOrPass(Auction, 3, BidColor.NoTrump, $"Partner proponuje BA po naszym kolorze, co zgadza się z szacowanymi punktami pary: {combinedHand.Points}, ale nie z układem ręki. Niestety mało punktów, więc limit 3BA.");
                }

                // Nie pasuje nam BA (lub jeszcze o tym nie wiemy).
                // Nie próbujemy powtarzać koloru, zgłaszamy drugi najlepszy.
                var secondBestColor = strongestColors[1];
                if (hand.CountCards(secondBestColor) >= 4) {
                    // Limit poziomu - 3.
                    return BidNode.SubmitLowest(Auction, secondBestColor.ToBidColor(), 3, $"Partner proponuje BA po naszym kolorze, co bardzo nam się nie podoba. Pokazanie drugiego najlepszego koloru.");
                }

                // Fallback - zgłoszenie BA.
                return BidNode.SubmitLowest(Auction, BidColor.NoTrump, 3, "Brak innej dobrej odzywki na propozycję BA partnera.");
            }

            // BA na tym samym poziomie.
            // Jeżeli na to odpowiada i mamy weakHand, to pass.
            if (hand.HasEvenDistribution() && !strongHand) {
                return BidNode.Pass("Słaba ręka z równym rozkładem, partner proponuje BA, więc pas.");
            }
            // Jeżeli stronghand, to szukamy gry BA.
            else if (hand.HasEvenDistribution()) {
                return BidNode.SubmitLowest(Auction, BidColor.NoTrump, 3, "Równy rozkład, mocna ręka. Akceptujemy propozycję BA partnera.");
            }

            // Jeżeli nasz najdłuższy kolor jest 6-kartowy, to go powtarzamy na poziomie trzech (strongHand) lub dwóch.
            if (hand.CountCards(longestColor) >= 6 && (Auction.GetLowestLegalValue(longestColor.ToBidColor()) == 3 && strongHand || Auction.GetLowestLegalValue(longestColor.ToBidColor()) == 2)) {
                return BidNode.SubmitLowest(Auction, longestColor.ToBidColor(), explanation: "Powtórzenie dobrego, sześciokartowego koloru na poziomie 2 lub 3, zależnie od siły ręki.");
            }

            // Nie ma z czym grać.
            return BidNode.Pass("Partner propounuje BA, a my mamy śmietnik nie do grania.");
        }

        // Kolor na bez atu.
        if (lastOwnBidColor.IsNoTrumpGame() && partnerBidNode.Color.IsColorGame()) {
            // Z przeskokiem - dobra ręka partnera.
            if (partnerRaised) {
                if (hand.Fits(partnerBidNode.Color)) {
                    return BidNode.SubmitLowestLegalGameOrDouble(Auction, partnerBidNode.Color, "Akceptacja koloru partnera zgłoszonego z przeskokiem po naszym BA, więc licytujemy końcówkę lub kontrę na mięso.");
                }

                // Gdy nie mamy fitu, to z silną ręką zgłaszamy końcówkę w BA.
                if (strongHand) {
                    return BidNode.SubmitLowestLegalGameOrDouble(Auction, BidColor.NoTrump, "Brak fitu z partnerem (zgłosił przeskok), ale mamy punkty, powtórka BA.");
                }

                // Ze słabą - najdłuższy kolor, o ile da się go zgłosić na tym samym poziomie.
                if (Auction.GetLowestLegalValue(longestColor.ToBidColor()) == partnerBidNode.GetLevel()) {
                    return BidNode.SubmitLowest(Auction, longestColor.ToBidColor(), explanation: "Brak fitu z partnerem (zgłosił przeskok), słaba ręka. Próbujemy powtórzyć najdłuższy kolor bez podnoszenia licytacji.");
                }

                // Jeżeli nie, to zgłaszamy BA na najniższym możliwym poziomie.
                return BidNode.SubmitLowest(Auction, BidColor.NoTrump, 4, "Brak fitu z partnerem (zgłosił przeskok), próbujemy znowu BA.");
            }

            // Bez przeskoku, nie szarżujemy. 
            // Poparcie.
            if (hand.Fits(partnerBidNode.Color)) {
                return BidNode.SubmitLowest(Auction, partnerBidNode.Color, strongHand ? 4 : 3, "Akceptacja koloru partnera zgłoszonego bez przeskoku po naszym BA, zatem powoli.");
            }

            // Brak fitu - zgłaszamy najdłuższy kolor, max na poziomie 3.
            return BidNode.SubmitLowest(Auction, longestColor.ToBidColor(), 3, explanation: "Brak fitu, powtórzenie najdłuższego koloru na poziomie 3.");
        }

        return BidNode.Pass("Brak innych dostępnych odzywek.");
    }

    /// <summary>
    /// Zwraca naturalną odpowiedź, na podstawie możliwych gałęzi partnera
    /// </summary>
    /// <returns></returns>
    private BidNode GetNaturalBid(Hand hand, Dictionary<BidNode, TableEvaluation> partnerBranches, bool isForced = false) {
        var chosenBidNodes = new List<BidNode>();
        var openings = BiddingSystem.Openings();
        var confusingBids = new List<string>();

        foreach (var branch in partnerBranches) {
            BidNode? chosenBidNode;
            if (Auction.Interrupted(onlySubmit: true)) {
                chosenBidNode = TrueNaturalResponse(hand, branch.Key, branch.Value); 
            } else {
                var responseCandidate = TrueNaturalResponse(hand, branch.Key, branch.Value);
                chosenBidNode = responseCandidate.AssertFreestyleIsntConfusing(openings, branch.Key);
                if (responseCandidate != null && chosenBidNode == null) {
                    confusingBids.Append(responseCandidate.ToString());
                }
            }

            if (chosenBidNode != null && chosenBidNode.Type != BidType.Pass) {
                chosenBidNodes.Add(chosenBidNode);
            }
        }

        var chosenBid = GetLowestSubmitOrPass(chosenBidNodes);
        if (confusingBids.Count > 0) {
            chosenBid.Explanation += "Wyeliminowano mylące odzywki: " + string.Join(", ", confusingBids);
        }

        if (isForced && chosenBid.Type == BidType.Pass) {
            var forcedBid = ForcedToBid(hand);
            if (confusingBids.Count > 0) {
                forcedBid.Explanation += "Wyeliminowano mylące odzywki: " + string.Join(", ", confusingBids);
            }
            return forcedBid;
        }

        return chosenBid;
    }


    private BidNode GetNaturalBid(Hand hand, Dictionary<BidNode, List<TableEvaluation>> partnerPossibleEvaluations, bool isForced = false) {
        var chosenBidNodes = new List<BidNode>();
        var openings = BiddingSystem.Openings();
        var confusingBids = new List<string>();

        foreach (var branch in partnerPossibleEvaluations) {
            foreach (var possibleEvaluation in branch.Value) {
                BidNode? chosenBidNode;
                if (Auction.Interrupted(onlySubmit: true)) {
                    chosenBidNode = TrueNaturalResponse(hand, branch.Key, possibleEvaluation);
                } else {
                    var responseCandidate = TrueNaturalResponse(hand, branch.Key, possibleEvaluation);
                    chosenBidNode = responseCandidate.AssertFreestyleIsntConfusing(openings, branch.Key);
                    if (responseCandidate != null && chosenBidNode == null) {
                        confusingBids.Append(responseCandidate.ToString());
                    }
                }

                if (chosenBidNode != null && chosenBidNode.Type != BidType.Pass) {
                    chosenBidNodes.Add(chosenBidNode);
                }
            }
        }

        var chosenBid = GetLowestSubmitOrPass(chosenBidNodes);
        if (confusingBids.Count > 0) {
            chosenBid.Explanation += "Wyeliminowano mylące odzywki: " + string.Join(", ", confusingBids);
        }

        if (isForced && chosenBid.Type == BidType.Pass) {
            var forcedBid = ForcedToBid(hand);
            if (confusingBids.Count > 0) {
                forcedBid.Explanation += "Wyeliminowano mylące odzywki: " + string.Join(", ", confusingBids);
            }
            return forcedBid;
        }

        return chosenBid;
    }

    /// <summary>
    /// Należy wywołać tą funckję tylko jako ostateczność! Zakłada, że nie ma fitu, bo wtedy coś wcześniej zwróciłoby odpowiednią odzywkę?
    /// TableEvaluation lub freestyle nie działa, trafiamy kiedy są punkty i fit!!
    /// Zwraca pass tylko i wyłącznie, jeżeli poprzednia odzywka partnera jest rekontrą lub robi partię.
    /// </summary>
    private BidNode ForcedToBid(Hand hand) {
        var lastPartnerBid = Auction.GetLastPlayerBid(PartnerPosition, passAsNull: false);
        var lastOwnBid = Auction.GetLastPlayerBid(Position, passAsNull: false);
        var firstPartnerBid = Auction.FirstPlayerBid(PartnerPosition);

        if (Auction.GetLastPlayerBid(PartnerPosition, passAsNull: false)!.Type == BidType.Redouble || Auction.GetLastPlayerBid(PartnerPosition, passAsNull: false)!.MakesGame()) {
            return BidNode.Pass("Naturalny pass po forcingu, po dojściu na poziom gry.");
        }

        // Najsilniejszy kolor, którego jeszcze nie zgłaszaliśmy i ma on więcej niz 3 karty
        BidNode? resultInColor = null;
        foreach (CardColor color in hand.GetStrongestColors()) {
            if (OwnBidsHistory.All(e => e.Color != color.ToBidColor()) && hand.OfColor(color).Count() > 3) {
                resultInColor = BidNode.SubmitLowest(Auction, color.ToBidColor(), "Naturalna propozycja nowego, niezgłaszanego wcześniej koloru, na najniższym możliwym poziomie.");
                break;
            }
        }

        // Lepiej zgłości 3 BA niż NOWY kolor na wysokości 4.
        if (resultInColor?.Value > 3) {
            if (Auction.GetLowestLegalValue(BidColor.NoTrump) == 3) {
                var ntResult = BidNode.Submit(3, BidColor.NoTrump, "Naturalne zgłoszenie 3BA zamiast nowego koloru na poziomie 4.");
                return ntResult;
            } 
        }
        else if (resultInColor != null) {
            return resultInColor;
        }

        // Nie ma fitu z partnerem, zgłosiliśmy już swoje dobre kolory, więc mozliwie najniższe BA i niech on decyduje.
        var result = BidNode.SubmitLowest(Auction, BidColor.NoTrump, "Brak fitu z partnerem i brak własnego 3-kartowego koloru, zgłoszono naturalne BA na najniższym możliwym poziomie.");
        return result;
    }


    private BidNode GetLowestSubmitOrPass(IEnumerable<BidNode> bidCandidates) {
        return bidCandidates
            .Where(e => e.Type == BidType.Submit)
            .OrderBy(e => e.Value)
            .ThenByDescending(e => (int)e.Color)
            .FirstOrDefault()
            ?? BidNode.Pass("Nie znaleziono pasującej odzywki");
    }
}
