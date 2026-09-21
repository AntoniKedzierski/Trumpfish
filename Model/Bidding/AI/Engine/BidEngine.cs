using Model.Bidding.AI.Eval;
using Model.Bidding.Bids;
using Model.Enums;
using Model.Helpers;

namespace Model.Bidding.AI.Engine;

public partial class BidEngine {

    public Hand Hand { get; private set; }

    public Auction Auction { get; private set; }

    public BiddingSystem BiddingSystem { get; private set; }

    public PlayerPosition Position { get; private set; }

    public PlayerPosition LeftOpponentPosition => Position.GetLeftOpponent();

    public PlayerPosition PartnerPosition => Position.GetPartner();

    public PlayerPosition RightOpponentPosition => Position.GetRightOpponent();

    public List<BidNode> OwnBidsHistory { get; private set; } = [];

    public List<SystemBranch> Branches { get; private set; } = [];

    public bool PartnerOpened { get; private set; } = false;

    public BiddingGoal Goal { get; private set; }

    public int DealNumber { get; private set; }

    /// <summary>
    /// Creates an engine on top of an already loaded system, so hosts (server simulation) do not depend on the file system.
    /// </summary>
    public BidEngine(Hand hand, Auction auction, PlayerPosition position, BiddingSystem biddingSystem, int dealNumber) {
        Hand = hand;
        Auction = auction;
        BiddingSystem = biddingSystem;
        Position = position;
        Goal = BiddingGoal.None;
        DealNumber = dealNumber;
    }


    public Bid Get() {
        var selectedBidNode = SelectOptimalBid();

        if (selectedBidNode?.IsBidLegal(Auction) == false) {
            throw new Exception("Nielegalna odzywka ma zostać zgłoszona!");
        }

        if (selectedBidNode == null) {
            return Bid.Pass("Nie znaleziono żadnej pasującej odzywki w systemie ani naturalnie.");
        }

        OwnBidsHistory.Add(selectedBidNode);
        return selectedBidNode.ToBid();
    }


    public List<InterruptedBid> GetBidSequence() => Auction
        .GetPlayersSequence(Position, out var _)
        .Where(e => e.Type != BidType.Pass)
        .ToList();


    public void InitializeBranch(BidNode ownBid) {
        if (Branches.Count > 0) {
            return;
        }

        Branches = [new SystemBranch(ownBid, Hand, Auction, Position)];
    }


    public void UpdateBranches(BidNode ownBid) {
        if (Branches.Count == 0) {
            InitializeBranch(ownBid);
            return;
        }

        // Aktualizacja gałęzi o nową odzywkę.
        var newBranches = new List<SystemBranch>();
        foreach (var branch in Branches) {
            newBranches.AddRange(BiddingSystem.ExpandBranch(branch, ownBid, PartnerOpened));
        }

        Branches = newBranches;
    }


    public void UpdateBranches() {
        var bidSequence = GetBidSequence();
        if (bidSequence.Count == 0) {
            return;
        }

        // Inicjalizacja gałęzi odzywką partnera.
        if (Branches.Count == 0) {
            Branches = BiddingSystem.GetBranches(bidSequence, Hand, Auction, Position);
            return;
        }

        // Aktualizacja gałęzi o nową odzywkę.
        var newBranches = new List<SystemBranch>();
        var newBid = bidSequence.Last();

        foreach (var branch in Branches) {
            newBranches.AddRange(BiddingSystem.ExpandBranch(branch, newBid, PartnerOpened));
        }

        // Jeżeli jakaś gałąź nie jest Extended, to znaczy, że istnieje jeszcze ścieżka w systemie.
        // Usuwamy wszystkie extendy.
        if (newBranches.Any(e => e.OnlySystem)) {
            Branches = newBranches.Where(e => e.OnlySystem).ToList();
        }
        else {
            Branches = newBranches;
        }
    }


    private BidNode? SelectOptimalBid() {
        // Sprawdzenie, kto otworzył licytację.
        PartnerOpened = Auction.PlayerOpenedAuction(PartnerPosition);

        // Pusta licytacja, próbujemy otworzyć.
        if (!Auction.AnySubmits()) {
            return TrySystemOpening(Hand);
        }

        // Najpierw ten po prawej, potem po lewej.
        var lastPartnerBid = Auction.GetLastPlayerBid(PartnerPosition, passAsNull: true);
        var leftOpponentBid = Auction.GetLastPlayerBid(LeftOpponentPosition, passAsNull: true);
        var rightOpponentBid = Auction.GetLastPlayerBid(RightOpponentPosition, passAsNull: true);
        var bidSequence = GetBidSequence();

        // Partner się nie odzywał lub spasował.
        // Jeżeli licytacja znowu doszła od nas, to znaczy, że głos przejęli oponenci.
        if (lastPartnerBid == null) {
            // Musieli coś mówić, no kurwa...
            if (leftOpponentBid == null && rightOpponentBid == null) {
                throw new Exception("Invalid auction.");
            }

            // Jeżeli cokolwiek mówiliśmy jako para (dwie odzywki), to sprawdzamy, czy nie robią nas w chuja i czy nie chcą zablokować licytacji.
            // Gramy pod karę dla przeciwników lub zgłaszamy partię/grę premiową, jak wychodzi nam to z punktów.
            if (bidSequence.Count > 1) {
                return BidNode.Pass("Licytacja karna nie zaimplementowana.");
            }

            // Jeżeli nic nie mówiłem, to mogę spróbować otworzyć.
            if (OwnBidsHistory.Count == 0) {
                // Mimo wszystko preferowane jest otwarcie z systemu.
                // Gdy dostajemy null, to próbujemy odzywek obronnych.
                return TrySystemOpening(Hand) ?? TrySystemDefence(Hand, rightOpponentBid ?? leftOpponentBid);

                // Tutaj dopisać wcinanie się na wyższym poziomie, pod minimalizację straty.
            }

            return BidNode.Pass("Nie wiadomo co zrobić.");
        }

        // Utwórz zbiór wszystkich możliwych gałęzi w sekwensie odzywek.
        // To zadziała na podstawie odzywki partnera.
        UpdateBranches();
        var result = Branches.GetNextBid();

        // Dołożenie własnej odzywki do gałęzi.
        if (result != null) {
            UpdateBranches(result);
        }

        return result;
    }


    public BidNode? TrySystemOpening(Hand hand) {
        var result = BiddingSystem.Openings().Bids
            .Where(e => !e.IsDisabled)
            .Where(e => e.IsBidLegal(Auction))
            .Where(e => e.Matches(hand))
            .OrderByDescending(e => e.IsPreferred ? 1 : 0)
            .ThenBy(e => e)
            .FirstOrDefault();

        if (result != null) {
            result.IsFromSystem = true;
            InitializeBranch(result);
        }

        return result;
    }


    /// <summary>
    /// Wejście w obrony jako pierwszy z pary
    /// </summary>
    public BidNode? TrySystemDefence(Hand hand, Bid lastOpponentsBid) {
        var defences = BiddingSystem.Defences();
        if (defences == null) {
            return null;
        }

        var result = defences.Bids
            .Where(e => !e.IsDisabled && e.Interjection != null)
            .Where(e => e.Interjection!.Equals(lastOpponentsBid))
            .Where(e => e.IsBidLegal(Auction))
            .Where(e => e.Matches(hand))
            .OrderByDescending(e => e.IsPreferred ? 1 : 0)
            .ThenBy(e => e)
            .FirstOrDefault();

        if (result == null) {
            return null;
        }

        // Oznaczenie, że to z systemu.
        result.IsFromSystem = true;
        if (result.GoToOpenings) {
            return TrySystemOpening(hand);
        }

        InitializeBranch(result);
        return result;
    }

}
