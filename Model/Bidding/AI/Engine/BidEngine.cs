using Model.Bidding.AI.Eval;
using Model.Bidding.Bids;
using Model.Enums;
using Model.Helpers;

namespace Model.Bidding.AI.Engine;

public partial class BidEngine : IBidInput {

    public Auction Auction { get; private set; }

    public BiddingSystem BiddingSystem { get; private set; }

    public string BiddingSystemPath { get; set; } = "../../../../../BiddingSystems/Wspólny Język.json";

    public PlayerPosition Position { get; private set; }

    public PlayerPosition LeftOpponentPosition => Position.GetLeftOpponent();

    public PlayerPosition PartnerPosition => Position.GetPartner();

    public PlayerPosition RightOpponentPosition => Position.GetRightOpponent();

    public List<BidNode> OwnBidsHistory { get; private set; } = [];

    public BidNode? LastOwnBid => OwnBidsHistory.LastOrDefault();

    public Bid? LastOpponentBid => Auction.GetLastPlayerBid(RightOpponentPosition, passAsNull: true) ?? Auction.GetLastPlayerBid(LeftOpponentPosition, passAsNull: true);

    public Bid? LastRightOpponentBid => Auction.GetLastPlayerBid(RightOpponentPosition, passAsNull: true);

    public BiddingGoal Goal { get; private set; }

    public bool PartnerOpened { get; private set; } = false;


    public BidEngine(Auction auction, PlayerPosition position) {
        Auction = auction;
        BiddingSystem = new BiddingSystem(BiddingSystemPath);   // hardcoded path for now
        Position = position;
        Goal = BiddingGoal.None;
    }


    /// <summary>
    /// Creates an engine on top of an already loaded system, so hosts (server simulation) do not depend on the file system.
    /// </summary>
    public BidEngine(Auction auction, PlayerPosition position, BiddingSystem biddingSystem) {
        Auction = auction;
        BiddingSystem = biddingSystem;
        Position = position;
        Goal = BiddingGoal.None;
    }


    public void Reset() {
        OwnBidsHistory.Clear();
        Goal = BiddingGoal.None;
    }


    public Bid Get(Hand hand, int? dealNumber = null) {
        var selectedBidNode = SelectOptimalBid(hand, dealNumber);

        if (selectedBidNode?.IsBidLegal(Auction) == false) {
            throw new Exception("Nielegalna odzywka ma zostać zgłoszona!");
        }

        if (selectedBidNode == null) {
            return Bid.Pass("Nie znaleziono żadnej pasującej odzywki w systemie ani naturalnie.");
        }

        OwnBidsHistory.Add(selectedBidNode);
        return selectedBidNode.ToBid();
    }


    private BidNode? SelectOptimalBid(Hand hand, int? dealNumber = null) {
        // Najpierw ten po prawej, potem po lewej.
        var rightOpponentBid = Auction.GetLastPlayerBid(RightOpponentPosition, passAsNull: true);
        var leftOpponentBid = Auction.GetLastPlayerBid(LeftOpponentPosition, passAsNull: true);
        var lastPartnerBid = Auction.GetLastPlayerBid(PartnerPosition, passAsNull: true);
        var partnerOpened = Auction.PlayerOpenedAuction(PartnerPosition);

        // Pusta licytacja, próbujemy otworzyć.
        if (!Auction.AnySubmits()) {
            return TryOpen(hand);
        }

        // W pierwszym kółku: oponenci coś mówili, partner pasował lub jeszcze się nie odzywał.
        if (Auction.Loop == 0 && (leftOpponentBid != null || rightOpponentBid != null) && lastPartnerBid == null) {
            return TrySoloDefend(hand, (rightOpponentBid ?? leftOpponentBid)!) ?? TryOpen(hand);
        }

        // W pierwszym kółku: partner coś mówił.
        if (Auction.Loop == 0 && lastPartnerBid != null) {
            var firsPartnersSubmit = Auction.FirstPlayerBid(PartnerPosition)!;
            // Trzeba znaleźć odzywkę przed pierwszą odzywką partnera, czyli tą z której weszliśmy do obron.
            var defendingAgainst = Auction.AuctionHistory  
                .Take(Auction.AuctionHistory.IndexOf(firsPartnersSubmit))
                .LastOrDefault(e => e.Type == BidType.Submit);
            return partnerOpened
                ? TryRespondToOpening(hand, lastPartnerBid, rightOpponentBid)
                : TryContinueSystemDefence(hand, lastPartnerBid, defendingAgainst);
        }

        // Tutaj licytacja na pewno trwała dłużej niż jedno kółko.
        DetermineGoal();

        // Jeżeli partner ostatnio pasował, to znaczy, że skonczyliśmy system.
        // Szukamy wtrącenia, przeszkadzania, grania pod minimalną stratę, kontry.
        if (lastPartnerBid == null) {
            return null;
        }

        // Bierzemy tylko naszą sekwencję, bez pasów.
        var bidSequence = Auction
            .GetPlayersSequence(Position, out var _)
            .Where(e => e.Type != BidType.Pass)
            .ToList();

        // Jeżeli partner tylko otworzył (jedna odzywka z naszym sekwensie),
        // to próbujemy mu odpowiedzieć.
        if (bidSequence.Count == 1) {
            return TryRespondToOpening(hand, lastPartnerBid, rightOpponentBid);
        }

        // Szukamy odzywki w systemie.
        var result = TryContinueSystemOrNatural(hand, bidSequence);

        // Jak coś znaleźliśmy w systemie, to kończymy.
        if (result != null) {
            result.RealizedGoal = Goal;
        }

        // Pomijamy obronę po pierwszym kółku.
        // TODO - wtrącenia, przeszkadzanie, granie pod minimalizację straty, kontry.
        return result;
    }


    public void DetermineGoal() {
        // Pierwsze określenie celu, po pierwszym okrążeniu licytacji.
        if (Goal == BiddingGoal.None) {
            var ourSequence = Auction.GetPlayersSequence(Position, out var openingPlayer);
            var opponentsSequence = Auction.GetPlayersSequence(LeftOpponentPosition, out var openingOpponent);

            // Zliczanie pasów? Chyba nienajgorsza metoda...
            var oursPassCount = ourSequence.Count(e => e.Type == BidType.Pass);
            var theirsPassCount = opponentsSequence.Count(e => e.Type == BidType.Pass);

            if (oursPassCount == theirsPassCount) {
                Goal = BiddingGoal.None;
                return;
            }

            // Finalnie, ten kto mniej pasował, ma grać.
            Goal = theirsPassCount < oursPassCount ? BiddingGoal.Pass : BiddingGoal.Game;
            return;
        }

        // Gdy wcześniej mieliśmy pasować, a przeciwnicy jeszcze nie doszli do partii.
        if (Goal == BiddingGoal.Pass) {
            if (!Auction.ReachedGameLevel()) {
                Goal = BiddingGoal.Pass;
                return;
            }

            // Jeżeli doszli do partii, to przeliczamy, czy opłaca się samemu zgłaszać kontrakt w celu zminimalizowania strat.
            Goal = BiddingGoal.MinLoss;
        }

        // Jeżeli był Game lub GF to trzeba się upewnić, że nie powinno przejść na grę premiową
        if (Goal == BiddingGoal.Game || Goal == BiddingGoal.Gf) {

        }

        // Goal pozostaje niezmieniony.
    }


    /// <summary>
    /// Wejście w obrony jako pierwszy z pary
    /// </summary>
    public BidNode? TrySoloDefend(Hand hand, Bid bidToDefendAgainst) {
        // Gałąź z konwencjami obronnymi na ostatnią odzywkę przeciwników.
        var defences = BiddingSystem.Defences() ?? throw new Exception("Defences not found.");
        var defenceBranch = defences.Bids.FirstOrDefault(e => e.EqualsByColorAndValue(bidToDefendAgainst));

        // Nie pasuje nam żadna linia obrony.
        if (defenceBranch == null) {
            return null;
        }

        // Szukamy w gałęziach obronnych.
        var result = GetBidFromSystemBranches(hand, [defenceBranch]);

        // Jeżeli znaleziona odzywka nakazuje otworzyć.
        return result?.GoToOpenings == true ? TryOpen(hand) : result;
    }


    /// <summary>
    /// Wejście w obrony po partnerze
    /// </summary>
    public BidNode? TryContinueSystemDefence(Hand hand, Bid lastPartnerBid, Bid? defenceHead) {
        var defences = BiddingSystem.Defences() ?? throw new Exception("Defences not found.");
        var defenceBranch = defences.Bids.FirstOrDefault(e => e.EqualsByColorAndValue(defenceHead));

        // Póki co brak obrony spoza systemu.
        if (defenceBranch == null) {
            return null;
        }

        var descendants = LastOwnBid == null
            ? BiddingSystem.GetDescendants(defenceBranch, lastPartnerBid)
            : BiddingSystem.GetDescendants(LastOwnBid, lastPartnerBid);

        var branches = descendants
            .ToDictionary(
                e => e,
                e => Evaluator.FromPartner(e, hand, Auction, Position)
            );

        // Nigdy nie powinniśmy wejść w obrony, jeżeli już wcześniej było GF
        if (Goal == BiddingGoal.Gf) {
            throw new Exception("Play in defenece impossible while already GF");
        }

        // Potencjalne przeście na GF lub na jedno kółko
        var isForced = false;
        if (branches.Keys.All(e => e.IsGameForcing())) {
            Goal = BiddingGoal.Gf;
            isForced = true;
        }

        // Pomijamy sprawdzenie, czy licytacja nie była przerywana przez oponentów (bo była xd). 
        if (!isForced && branches.Keys.All(e => e.OneRoundForcing == true)) {
            isForced = true;
        }

        var result = GetBidFromSystemBranches(hand, [.. branches.Keys]);

        // Żebym w następnym kółku nie spasował po moim własnym GF.
        // Tylko gdy z systemu coś wynika.
        if (result?.GameForcing == true) {
            Goal = BiddingGoal.Gf;
        }

        return result;
    }


    public BidNode? TryOpen(Hand hand) {
        var openings = BiddingSystem.Openings() ?? throw new Exception("Openings not found");
        var bidCandidates = FindNodesByHand(hand, openings).Where(e => e.IsBidLegal(Auction)).ToList();
        var chosenBid = ChooseBidFromSystem(bidCandidates, preferConventions: true);
        return chosenBid;
    }


    public BidNode? TryRespondToOpening(Hand hand, Bid partnerBid, Bid? rightOpponentBid) {
        var branches = BiddingSystem
            .GetOpenings(partnerBid)
            .ToDictionary(
                e => e,
                e => Evaluator.FromPartner(e, hand, Auction, Position)
            );

        // Bezpośrednio po otwarciu nie ma GameForcingu, nie ma Forcingu na jedno kółko, po prostu odpowiedź z systemu.
        // Nie dajemy również odpowiedzi off-system z licytacji naturalnej, system ma to zawierać (jeżeli nie zawiera, to pass).
        return GetBidFromSystemBranches(hand, [.. branches.Keys], rightOpponentBid);
    }


    public BidNode? TryContinueSystemOrNatural(Hand hand, List<Bid> bidSequence) {
        if (bidSequence.Count <= 1) {
            throw new Exception("Próba odpowiedzi na jednoelementowy sekwens odzywek.");
        }

        var lastPartnerBid = Auction.GetLastPlayerBid(PartnerPosition, passAsNull: true);
        var branches = BiddingSystem
            .GetDescendants(bidSequence)
            .ToDictionary(
                e => e,
                e => Evaluator.FromPartner(e, hand, Auction, Position)
            );


        // Nie ma dopasowań, czyli partner mówił naturalnie.
        if (branches.Count == 0) {
            // Jeżeli bidSequence.Count <= 2, to znaczy, że partner nie odzywał się wcześniej.
            // Zwracamy null, bo po pierwszej odzywce nie wolno mówić naturalnie.
            if (bidSequence.Count <= 2 || lastPartnerBid == null) {
                return null;
            }

            // Cofamy się o jedno kółko, żeby określić siłę partnera na podstawie jego systemowych odzywek.
            var previousLoopBidSequence = bidSequence[0..(bidSequence.Count - 2)];
            var previousBranches = BiddingSystem
                .GetDescendants(previousLoopBidSequence)
                .ToDictionary(
                    e => e,
                    e => Evaluator.FromPartner(e, hand, Auction, Position)
                );

            // Partner mógł zgłosić inwit lub partię.
            // Proponowanie nowego koloru po systemie nie wchodzi w grę (od tego jest system)!
            // Jeżeli odzywka partnera nie robi gry, to znaczy, że to inwit.
            if (!lastPartnerBid.MakesGame()) {
                return TrySelectContract(hand, previousBranches, Goal == BiddingGoal.Gf, lastPartnerBid.Color);
            }

            // Próbujemy gier premiowych.
            return TrySlamConventions(hand, branches);
        }

        // Sprawdzenie GameForcingu.
        var isForced = Goal == BiddingGoal.Gf;

        // Sprawdzenie GF na gałęziach.
        if (!isForced && branches.Keys.All(e => e.IsGameForcing())) {
            Goal = BiddingGoal.Gf;
            isForced = true;
        }

        // Sprawdzenie forcingu na jedno kółko.
        if (!isForced && branches.Keys.All(e => e.OneRoundForcing == true) && !Auction.Interrupted()) {
            isForced = true;
        }

        // Security check, sprawdzamy gałęzie do samej góry, czy nie ma tam GF.
        if (!isForced) {
            Goal = BiddingGoal.Gf;
            isForced = AnyGfInAllBranches(branches.Keys);
        }

        // Pobranie odpowiedzi z dostępnych gałęzi.
        var result = GetBidFromSystemBranches(hand, [.. branches.Keys]);

        // Żebym w następnym kółku nie spasował po moim własnym GF.
        // Tylko gdy z systemu coś wynika.
        if (result?.GameForcing == true) {
            Goal = BiddingGoal.Gf;
        }

        // Koniec systemu.
        return result
            ?? TrySlamConventions(hand, branches)
            ?? TrySelectContract(hand, branches, isForced: isForced)
            ?? TryInvite(hand, branches, isForced: isForced);
    }


    private BidNode? TrySlamConventions(Hand hand, Dictionary<BidNode, TableEvaluation> branches) {
        return null;
    }


    private bool AnyGfInAllBranches(IEnumerable<BidNode> branches) {
        var allBranchesGf = true;
        foreach (var branch in branches) {
            var anyGf = false;
            var bid = branch;

            while (bid != null) {
                anyGf |= bid.GameForcing;
                bid = bid.Parent;
            }

            allBranchesGf &= anyGf;
        }

        return allBranchesGf;
    }


    private static List<BidNode> GoUp(List<BidNode> nodes, int steps) {
        var result = nodes;
        for (int i = 0; i < steps; ++i) {
            result = [.. result
                .Where(e => e.Parent != null)
                .Select(e => e.Parent!)];
        }
        return result;
    }

}
