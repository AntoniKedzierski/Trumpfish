using Model.Bidding;
using Model.Bidding.AI.Engine;
using Model.Bidding.Bids;
using Model.Enums;
using Model.Helpers;
using System;
using System.Collections.Generic;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Model.Bidding.AI.Eval; 

public class HandEvaluation {

    public NumberRange Points { get; set; }

    public NumberRange Spades { get; set; }

    public NumberRange Hearts { get; set; }

    public NumberRange Diamonds { get; set; }

    public NumberRange Clubs { get; set; }

    public int? Aces { get; set; }

    public int? Kings { get; set; }


    public HandEvaluation() {
        Points = new NumberRange(0, 40);
        Spades = new NumberRange(0, 13);
        Hearts = new NumberRange(0, 13);
        Diamonds = new NumberRange(0, 13);
        Clubs = new NumberRange(0, 13);
    }


    public HandEvaluation(HandEvaluation other) {
        Points = new(other.Points);
        Spades = new(other.Spades);
        Hearts = new(other.Hearts);
        Diamonds = new(other.Diamonds);
        Clubs = new(other.Clubs);
        Aces = other.Aces;
        Kings = other.Kings;
    }


    public static HandEvaluation OnOwnHand(Hand hand) {
        return new() {
            Points = new NumberRange(hand.Points, hand.Points),
            Spades = new NumberRange(hand.SpadesCount, hand.SpadesCount),
            Hearts = new NumberRange(hand.HeartsCount, hand.HeartsCount),
            Diamonds = new NumberRange(hand.DiamondsCount, hand.DiamondsCount),
            Clubs = new NumberRange(hand.ClubsCount, hand.ClubsCount),
            Aces = hand.OfValue(CardValue.Ace).Count(),
            Kings = hand.OfValue(CardValue.King).Count()
        };
    }


    // TODO: getting information from stops and exact distributions in bid
    public void Evaluate(BidNode bidNode) {
        Points.Narrow(bidNode.PointsRange);
        Spades.Narrow(bidNode.SpadesCardRange);
        Hearts.Narrow(bidNode.HeartsCardRange);
        Diamonds.Narrow(bidNode.DiamondsCardRange);
        Clubs.Narrow(bidNode.ClubsCardRange);
        Aces = bidNode.Aces ?? Aces;
        Kings = bidNode.Kings ?? Kings;
    }


    public void Evaluate(HandEvaluation otherHandEvaluation) {
        Points.Narrow(new(null, 40 - otherHandEvaluation.Points.Lower));
        Spades.Narrow(new(null, 13 - otherHandEvaluation.Spades.Lower));
        Hearts.Narrow(new(null, 13 - otherHandEvaluation.Hearts.Lower));
        Diamonds.Narrow(new(null, 13 - otherHandEvaluation.Diamonds.Lower));
        Clubs.Narrow(new(null, 13 -otherHandEvaluation.Clubs.Lower));

        if (otherHandEvaluation.Aces != null) {
            Aces = 4 - otherHandEvaluation.Aces;
        }

        if (otherHandEvaluation.Kings != null) {
            Kings = 4 - otherHandEvaluation.Kings;
        }
    }


    public HandEvaluation Evaluate(Hand hand) {
        var newEvaluation = new HandEvaluation(this);
        newEvaluation.Points.Upper -= hand.PointsNt;
        newEvaluation.Spades.Upper -= hand.OfColor(CardColor.Spades).Count();
        newEvaluation.Hearts.Upper -= hand.OfColor(CardColor.Hearts).Count();
        newEvaluation.Diamonds.Upper -= hand.OfColor(CardColor.Diamonds).Count();
        newEvaluation.Clubs.Upper -= hand.OfColor(CardColor.Clubs).Count();

        // Asy i króle podawane są ze 100% pewnością.
        return newEvaluation;
    }


    public HandEvaluation Combine(Hand ownHand) {
        var result = OnOwnHand(ownHand);
        result.Points.Combine(Points, 40);
        result.Spades.Combine(Spades, 13);
        result.Hearts.Combine(Hearts, 13);
        result.Diamonds.Combine(Diamonds, 13);
        result.Clubs.Combine(Clubs, 13);

        result.Aces += Aces;
        if (result.Aces > 4) {
            result.Aces = 4;
        }

        result.Kings += Kings;
        if (result.Kings > 4) {
            result.Kings = 4;
        }

        return result;
    }


    public Dictionary<CardColor, NumberRange> GetColorRanges() => new() {
        { CardColor.Spades, Spades },
        { CardColor.Hearts, Hearts },
        { CardColor.Diamonds, Diamonds },
        { CardColor.Clubs, Clubs }
    };


    /// <summary>
    /// Zwraca ocenę kontraktu, jako liczbę z przedziału od 0 do +infty.
    /// TODO: Matematyczne uzasadnienie tego...
    /// </summary>
    /// <param name="bidColor"></param>
    /// <returns></returns>
    public double GetContractScore(BidColor bidColor) {
        // Metodologia: za każde odchylenie wykonujemy dzielenie prawdopodobieństwa przez wartość odchylenia.
        var result = 1.0;
        double Standarize(double probability) => Math.Sqrt(1 / (1 - 0.95 * probability) - 1);

        // BA: Za pewny kontrakt uznajemy cokolwiek powyżej 27 punktów, z minimum 4 kartami w każdym kolorze.
        if (bidColor.IsNoTrumpGame()) {
            result /= 28 - Math.Min(27, Points.Lower ?? 1);
            foreach (var cardCount in GetColorRanges()) {
                result /= 5 - Math.Min(4, cardCount.Value.Lower ?? 1);
            }
        }

        // Za pewny kontrakt uznajemy cokolwiek powyżej 26 punktów (kolor starszy) lub 28 punktów (kolor młodszy).
        // Dodatkowo 9 kart w tym kolorze.
        if (bidColor.IsColorGame()) {
            result /= bidColor.IsMajor()
                ? (27 - 0.25 * Math.Min(26, Points.Lower ?? 1))
                : (29 - 0.25 * Math.Min(28, Points.Lower ?? 1));

            var cardCount = GetSuit(bidColor.ToCardColor());

            // Brak szans, gdy mamy mniej atutów niż przeciwnicy.
            if (cardCount.Lower <= 6) {
                result = 0.0;
            }
            else if (cardCount.Lower <= 7) {
                result /= 10;
            }
            else if (cardCount.Lower <= 8) {
                result /= 1.25;
            }
        }

        return Math.Round(Standarize(result), 4);
    }


    /// <summary>
    /// Ma zastosowanie tylko dla ewaluacji siły połączonych rąk.
    /// </summary>
    /// <returns></returns>
    public BidColor FindFit(CardColor? except = null) {
        var colorRanges = GetColorRanges();
        var longestColorForSure = colorRanges
            .Where(e => except == null || e.Key != except.Value)
            .OrderByDescending(e => e.Value.Lower ?? 0)
            .ThenByDescending(e => (int)e.Key)              // Preferencja kolorów starszych
            .First()
            .Key;

        // Jeżeli maksimum w tym kolorze to 7 lub 8 (młodszy), to preferujemy BA.
        if (colorRanges[longestColorForSure] <= 7 || colorRanges[longestColorForSure] <= 8 && !longestColorForSure.IsMajor()) {
            return BidColor.NoTrump;
        }

        return longestColorForSure.ToBidColor();
    }


    public bool FitsNoTrump() {
        return !GetColorRanges().Where(e => e.Value.Lower != null).Any(e => e.Value.Lower < 4);
    }


    public bool FitsNoTrumpForSure() {
        return GetColorRanges().All(e => e.Value.Lower >= 4);
    }


    public Dictionary<CardColor, int> GetLowerColorBoundries() => GetColorRanges()
        .OrderByDescending(e => e.Value.Lower ?? 0)     // Najpierw pewna informacja o dolnych ograniczeniach.
        .ThenByDescending(e => e.Value.Upper ?? 0)      // Potem informacja o górnych ograniczeniach.
        .ThenByDescending(e => e.Key)                   // Preferencja kolorów starszych.
        .ToDictionary(e => e.Key, e => e.Value.Lower ?? 0);


    public NumberRange GetSuit(CardColor color) {
        return color switch {
            CardColor.Spades => Spades,
            CardColor.Hearts => Hearts,
            CardColor.Diamonds => Diamonds,
            CardColor.Clubs => Clubs,
            _ => throw new InvalidOperationException()
        };
    }


    public bool GoodToPlayColor(CardColor color) {
        var suitLength = GetSuit(color);
        return color.IsMajor()
            ? Points >= 24 && suitLength >= 8 || Points >= 23 && suitLength >= 9 || Points >= 22 && suitLength >= 10
            : Points >= 27 && suitLength >= 8 || Points >= 25 && suitLength >= 9 || Points >= 24 && suitLength >= 10;
    }


    public bool GoodToPlayColor(BidColor color) {
        return GoodToPlayColor(color.ToCardColor());
    }


    public bool CanClaimColorContract(out BidColor color) {
        // Zależy to od liczby kart w najliczniejszym kolorze.
        var bestColor = GetLowerColorBoundries().First();
        color = bestColor.Key.ToBidColor();

        // Nie mamy pewnej informacji o 8-kartowym kolorze (quick fallback).
        if (bestColor.Value < 8) {
            return false;
        }

        // Bloki zawsze dopuszczamy.
        if (bestColor.Value >= 11) {
            return true;
        }

        // Te limity są na stricte końcówkowe.
        return bestColor.Key.IsMajor()
            ? Points >= 24 && bestColor.Value >= 8 || Points >= 24 && bestColor.Value >= 9 || Points >= 23 && bestColor.Value >= 10
            : Points >= 27 && bestColor.Value >= 8 || Points >= 26 && bestColor.Value >= 9 || Points >= 25 && bestColor.Value >= 10;
    }


    public bool ShouldInviteToColorGame(out BidColor color) {
        // Zależy to od liczby kart w najliczniejszym kolorze.
        var bestColor = GetLowerColorBoundries().First();
        color = bestColor.Key.ToBidColor();

        // Nie mamy pewnej informacji o 7-kartowym kolorze (quick fallback).
        if (bestColor.Value < 7) {
            return false;
        }

        // Bloki zawsze dopuszczamy.
        if (bestColor.Value >= 10) {
            return true;
        }

        // Te limity są na stricte inwitowe, przy dobrej ręce partnera dostaniemy odpowiedź pozytywną.
        return bestColor.Key.IsMajor()
            ? Points >= 24 && bestColor.Value >= 7 || Points >= 23 && bestColor.Value >= 8 || Points >= 22 && bestColor.Value >= 9
            : Points >= 26 && bestColor.Value >= 7 || Points >= 25 && bestColor.Value >= 8 || Points >= 24 && bestColor.Value >= 9;
    }


    /// <summary>
    /// Czy można pokazać naturalne poparcie dla jakieś koloru?
    /// Limity takie, żeby można to było zgłosić na poziomie 2.
    /// </summary>
    public bool CanShowWeakColorSupport(out BidColor color) {
        // Zależy to od liczby kart w najliczniejszym kolorze.
        var bestColor = GetLowerColorBoundries().First();
        color = bestColor.Key.ToBidColor();

        // Nie ma czego popierać.
        if (bestColor.Value <= 6 || Points.Lower <= 20) {
            return false;
        }

        // Nie dajemy słabego poparcia, tylko silne.
        if (Points.Lower >= 26) {
            return false;
        }

        return true;
    }


    public bool CanClaimNoTrumpContract() {
        var colorRanges = GetColorRanges();

        // Gdy mamy punkty i pewne informacje o dolnych ograniczeniach.
        if (Points <= 25) {
            return false;
        }

        // To jest siła połączonych rąk.
        return colorRanges.All(e => e.Value >= 4);
    }


    public bool ShouldInviteToNoTrumpGame() {
        var colorRanges = GetColorRanges();

        // Gdy mamy punkty i pewne informacje o dolnych ograniczeniach.
        if (Points <= 23) {
            return false;
        }

        return colorRanges.All(e => e.Value >= 3);
    }


    public override string ToString() {
        return $"P: {Points}; S: {Spades}; H: {Hearts}; D: {Diamonds}; C: {Clubs}";
    }

} 
