using Model.Bidding.Bids;
using Model.Enums;
using Model.Helpers;
using System;
using System.Collections.Generic;
using System.Linq;

namespace Model.Bidding;

public class Auction {

    /// <summary>
    /// Wartość zwracana przez <see cref="GetLowestLegalValue"/>, gdy w danym kolorze
    /// nie da się już wykonać żadnej legalnej odzywki (ostatnia to 7NT / 7 w wyższym kolorze).
    /// </summary>
    public const int NoLegalValue = 8;

    /// <summary>
    /// Gracz, który rozpoczyna licytację (odzywka o indeksie 0).
    /// </summary>
    public PlayerPosition Dealer { get; private set; }

    public PlayerPosition CurrentBidder { get; private set; }

    public List<Bid> AuctionHistory { get; private set; } = [];

    public int Loop => AuctionHistory.Count / 4;

    public Bid? LastBid => AuctionHistory.Count > 0 ? AuctionHistory[^1] : null;


    public void Start(PlayerPosition dealer) {
        Dealer = dealer;
        CurrentBidder = dealer;
        AuctionHistory = [];
    }


    public void Clear() {
        AuctionHistory.Clear();
        CurrentBidder = Dealer;
    }


    public void NextBidder() {
        CurrentBidder = (PlayerPosition)(((int)CurrentBidder + 1) % 4);
    }


    /// <summary>
    /// Licytacja kończy się po trzech kolejnych pasach po jakiejkolwiek odzywce
    /// oraz po czterech pasach na wejściu (przypadek brzegowy pokryty warunkiem Count >= 4).
    /// </summary>
    public bool IsCompleted() {
        if (AuctionHistory.Count < 4) {
            return false;
        }

        return AuctionHistory[^1].Type == BidType.Pass
            && AuctionHistory[^2].Type == BidType.Pass
            && AuctionHistory[^3].Type == BidType.Pass;
    }


    public void Submit(Bid bid) {
        ArgumentNullException.ThrowIfNull(bid);

        if (IsCompleted()) {
            throw new InvalidOperationException("Auction is already completed!");
        }

        if (!bid.IsBidLegal(this)) {
            throw new InvalidOperationException("Illegal bid!");
        }

        AuctionHistory.Add(bid);
        NextBidder();
    }


    public bool CanSubmit(int value, BidColor color) {
        return !IsCompleted() && new Bid(value, color).IsBidLegal(this);
    }


    /// <summary>
    /// Najniższy wysokość odzywki możliwy do zalicytowania w danym kolorze.
    /// </summary>
    /// <returns>Wartość 1-7, albo <see cref="NoLegalValue"/> gdy nie ma już legalnej odzywki.</returns>
    public int GetLowestLegalValue(BidColor color, int offset = 0) {
        var lastSubmission = GetLastSubmittedBid(onlySubmitions: true, offset: offset);

        if (lastSubmission?.Value == null) {
            return 1;
        }

        // Kolor niższy od żądanego -> ta sama wysokość wystarczy; równy lub wyższy -> trzeba podbić.
        return (int)lastSubmission.Color < (int)color
            ? lastSubmission.Value.Value
            : lastSubmission.Value.Value + 1;
    }


    /// <summary>
    /// Gracz, który wykonał odzywkę o indeksie <paramref name="i"/> w historii licytacji.
    /// </summary>
    public PlayerPosition GetBidder(int i) {
        if (i < 0 || i >= AuctionHistory.Count) {
            throw new ArgumentOutOfRangeException(nameof(i));
        }

        return (PlayerPosition)(((int)Dealer + i) % 4);
    }


    /// <summary>
    /// Ostatnia odzywka danego gracza.
    /// </summary>
    /// <param name="passAsNull">Gdy true, pas traktowany jest jak brak odzywki (null).</param>
    public Bid? GetLastPlayerBid(PlayerPosition bidderPosition, bool passAsNull = false) {
        for (int i = AuctionHistory.Count - 1; i >= 0; i--) {
            if (GetBidder(i) != bidderPosition) {
                continue;
            }

            var bid = AuctionHistory[i];
            return passAsNull && bid.Type == BidType.Pass ? null : bid;
        }

        return null;
    }


    /// <summary>
    /// Ostatnia licytowana (nie kontra/pas) odzywka danego gracza.
    /// </summary>
    public Bid? GetLastSubmittedBid(PlayerPosition bidderPosition) {
        for (int i = AuctionHistory.Count - 1; i >= 0; i--) {
            if (GetBidder(i) == bidderPosition && AuctionHistory[i].Type == BidType.Submit) {
                return AuctionHistory[i];
            }
        }

        return null;
    }


    /// <summary>
    /// Ostatnia odzywka w licytacji.
    /// </summary>
    /// <param name="onlySubmitions">
    /// true  - tylko odzywki typu <see cref="BidType.Submit"/> (pomija kontry i rekontry),
    /// false - dowolna odzywka inna niż pas.
    /// </param>
    /// <param name="offset">Ile ostatnich pozycji historii pominąć.</param>
    public Bid? GetLastSubmittedBid(bool onlySubmitions = false, int offset = 0) {
        for (int i = AuctionHistory.Count - offset - 1; i >= 0; i--) {
            var type = AuctionHistory[i].Type;

            if (onlySubmitions ? type == BidType.Submit : type != BidType.Pass) {
                return AuctionHistory[i];
            }
        }

        return null;
    }


    public Bid? GetLastSubmittedBid(out PlayerPosition? bidderPosition) {
        bidderPosition = null;

        for (int i = AuctionHistory.Count - 1; i >= 0; i--) {
            if (AuctionHistory[i].Type == BidType.Submit) {
                bidderPosition = GetBidder(i);
                return AuctionHistory[i];
            }
        }

        return null;
    }


    /// <summary>
    /// Znajduje na jaką odzywkę oponentów weszliśmy w obronę.
    /// </summary>
    /// <returns>
    /// Ostatnia nie-pasowa odzywka oponentów poprzedzająca pierwszy nie-pas pary obrońców,
    /// albo null jeżeli ta para sama otworzyła licytację (lub nie weszła do licytacji).
    /// </returns>
    public Bid? DefendingAgainst(PlayerPosition currentDefender) {
        var partner = currentDefender.GetPartner();

        for (int i = 0; i < AuctionHistory.Count; i++) {
            var bidder = GetBidder(i);

            if (bidder != currentDefender && bidder != partner) {
                continue;
            }

            if (AuctionHistory[i].Type == BidType.Pass) {
                continue;
            }

            // Pierwszy nie-pas naszej pary. Szukamy wstecz odzywki oponentów.
            // Jeżeli jej nie ma, to my otworzyliśmy licytację i nie jesteśmy w obronie.
            for (int j = i - 1; j >= 0; j--) {
                var previousBidder = GetBidder(j);

                if (previousBidder == currentDefender || previousBidder == partner) {
                    continue;
                }

                if (AuctionHistory[j].Type != BidType.Pass) {
                    return AuctionHistory[j];
                }
            }

            return null;
        }

        return null;
    }


    /// <summary>
    /// Czy dany gracz otworzył licytację, tzn. wykonał pierwszą nie-pasową odzywkę rozdania.
    /// </summary>
    public bool PlayerOpenedAuction(PlayerPosition bidderPosition) {
        for (int i = 0; i < AuctionHistory.Count; i++) {
            if (AuctionHistory[i].Type == BidType.Pass) {
                continue;
            }

            return GetBidder(i) == bidderPosition;
        }

        return false;
    }


    public Bid? FirstPlayerBid(PlayerPosition bidderPosition) {
        for (int i = 0; i < AuctionHistory.Count; i++) {
            if (GetBidder(i) == bidderPosition) {
                return AuctionHistory[i];
            }
        }

        return null;
    }


    /// <summary>
    /// Wszystkie odzywki pary danego gracza, w kolejności chronologicznej (łącznie z pasami).
    /// </summary>
    /// <param name="openingPlayer">Gracz z tej pary, który wykonał jej pierwszą nie-pasową odzywkę.</param>
    public List<Bid> GetPlayersSequence(PlayerPosition bidderPosition, out PlayerPosition? openingPlayer) {
        var playerBids = new List<Bid>();
        var partnerPosition = bidderPosition.GetPartner();

        openingPlayer = null;

        for (int i = 0; i < AuctionHistory.Count; i++) {
            var bidPlayer = GetBidder(i);

            if (bidPlayer != bidderPosition && bidPlayer != partnerPosition) {
                continue;
            }

            if (openingPlayer == null && AuctionHistory[i].Type != BidType.Pass) {
                openingPlayer = bidPlayer;
            }

            playerBids.Add(AuctionHistory[i]);
        }

        return playerBids;
    }


    public IEnumerable<Bid> GetBidSequence(bool includePass = false) {
        return AuctionHistory.Where(bid => includePass || bid.Type != BidType.Pass);
    }


    /// <summary>
    /// Sprawdza, czy któraś z par zalicytowała dokładnie podaną sekwencję odzywek
    /// (od początku swojej licytacji, pomijając początkowe pasy).
    /// </summary>
    /// <param name="sequence">Sekwencja odzywek rozdzielona przecinkami, np. "1S,2S".</param>
    public bool ContainsPairSequence(string sequence) {
        if (string.IsNullOrWhiteSpace(sequence)) {
            return false;
        }

        var pattern = sequence
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(e => new Bid(e))
            .ToList();

        if (pattern.Count == 0) {
            return false;
        }

        var pair1Sequence = GetPlayersSequence(PlayerPosition.North, out _);
        var pair2Sequence = GetPlayersSequence(PlayerPosition.East, out _);

        return StartsWithSequence(pair1Sequence, pattern)
            || StartsWithSequence(pair2Sequence, pattern);
    }


    private static bool StartsWithSequence(IReadOnlyList<Bid> pairSequence, IReadOnlyList<Bid> pattern) {
        var start = SkipLeadingPasses(pairSequence);
        var patternStart = SkipLeadingPasses(pattern);

        var patternLength = pattern.Count - patternStart;

        if (patternLength == 0 || pairSequence.Count - start < patternLength) {
            return false;
        }

        for (int i = 0; i < patternLength; i++) {
            if (!pairSequence[start + i].Equals(pattern[patternStart + i])) {
                return false;
            }
        }

        return true;
    }


    private static int SkipLeadingPasses(IReadOnlyList<Bid> bids) {
        int i = 0;
        while (i < bids.Count && bids[i].Type == BidType.Pass) {
            i++;
        }
        return i;
    }


    /// <summary>
    /// Czy wystąpiła interwencja, ale tylko bezpośrednio przed currentBidder!
    /// </summary>
    public bool Interrupted(bool onlySubmit = false) {
        var lastBid = LastBid;

        if (lastBid == null) {
            return false;
        }

        return onlySubmit
            ? lastBid.Type == BidType.Submit
            : lastBid.Type != BidType.Pass;
    }


    /// <summary>
    /// Rozgrywającym jest ten z pary, który jako pierwszy zalicytował kolor końcowego kontraktu.
    /// </summary>
    public PlayerPosition GetAuctionWinner(PlayerPosition onePlayerFromPlayingPair, BidColor color) {
        var partner = onePlayerFromPlayingPair.GetPartner();

        for (int i = 0; i < AuctionHistory.Count; i++) {
            if (AuctionHistory[i].Type != BidType.Submit || AuctionHistory[i].Color != color) {
                continue;
            }

            var bidder = GetBidder(i);
            if (bidder == onePlayerFromPlayingPair || bidder == partner) {
                return bidder;
            }
        }

        throw new InvalidOperationException(
            $"No {color} bid found for the pair of {onePlayerFromPlayingPair} in the auction history.");
    }


    public Contract GetContract(Player[] players) {
        var lastSubmit = GetLastSubmittedBid(out var bidderPosition);
        var lastNonPass = GetLastSubmittedBid();

        if (NobodyBidsYet() || lastSubmit?.Value == null || lastNonPass == null || bidderPosition == null) {
            return new() {
                Passed = true
            };
        }

        return new() {
            Value = lastSubmit.Value.Value,
            Color = lastSubmit.Color,
            IsDoubled = lastNonPass.Type == BidType.Double,
            IsRedoubled = lastNonPass.Type == BidType.Redouble,
            Player = GetAuctionWinner(bidderPosition.Value, lastSubmit.Color)
        };
    }


    public bool NobodyBidsYet() => AuctionHistory.All(e => e.Type == BidType.Pass);


    public bool ReachedGameLevel() => GetLastSubmittedBid(onlySubmitions: true)?.MakesGame() ?? false;

    public bool AnySubmits() => AuctionHistory.Any(e => e.Type == BidType.Submit);
}
