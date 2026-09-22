using Model.Bidding.AI.Eval;
using Model.Bidding.Bids;
using Model.Enums;
using Model.Helpers;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Model.Bidding.AI.Engine;

public class SystemBranch {

    public BidNode Head { get; private set; }

    public BiddingSystem BiddingSystem { get; private set; }

    public Hand Hand { get; private set; }

    public Auction Auction { get; private set; }

    public PlayerPosition Position { get; private set; }

    public bool PartnerOpened { get; private set; }

    public bool GameForcing { get; set; } = false;

    public virtual bool OnlySystem => true;

    public virtual Bid Result => Head;


    public SystemBranch(BiddingSystem system, BidNode branchHead, Hand hand, Auction auction, PlayerPosition position, bool partnerOpened) {
        BiddingSystem = system;
        Head = branchHead;
        Hand = hand;
        Auction = auction;
        Position = position;
        PartnerOpened = partnerOpened;
    }


    public SystemBranch(SystemBranch other) {
        BiddingSystem = other.BiddingSystem;
        Head = other.Head;
        Hand = other.Hand;
        Auction = other.Auction;
        Position = other.Position;
        PartnerOpened = other.PartnerOpened;
    }


    public SystemBranch? MakeNextBid(HashSet<InterruptedBid> confusingBids) {
        var nextBid = GetNextBid(confusingBids);
        if (nextBid == null) {
            return null;
        }

        // Odpowiedź z systemu - zmieniamy head na wybraną odzywkę.
        if (nextBid.SystemResponse) {
            Head = nextBid.BidNode;
            return this;
        }

        return new ExtendedSystemBranch(nextBid.BidNode, this);
    }


    public List<SystemBranch> UpdateBranch(InterruptedBid lastPartnerBid) {
        var bidSequence = Head.GetPath().Cast<InterruptedBid>().Append(lastPartnerBid).ToList();
        var newHeads = BiddingSystem.GetSequenceHeads(bidSequence);

        // Odzwyka partnera była spoza systemu.
        if (newHeads.Count == 0) {
            return [new ExtendedSystemBranch(lastPartnerBid, this)];
        }

        var newBranches = new List<SystemBranch>();
        foreach (var newHead in newHeads) {
            // Przodek odzywki partnera musi być identyczny, jak bieżący head (żeby pasowało do naszej ścieżki).
            if (newHead.Parent == null || !newHead.Parent.Equals(Head)) {
                continue;
            }

            var newBranch = new SystemBranch(this) {
                Head = newHead
            };

            newBranches.Add(newBranch);
        }

        return newBranches;
    }


    private List<BidNode> GetMatchingBids() {
        var leftOpponentsBid = Auction.GetLastPlayerBid(Position.GetLeftOpponent(), passAsNull: true);
        var rightOpponentsBid = Auction.GetLastPlayerBid(Position.GetRightOpponent(), passAsNull: true);
        var lastOpponentsBid = rightOpponentsBid ?? leftOpponentsBid;

        var matchingBids = Head.GetNextBids()
            .Where(e => e.Matches(Hand))
            .Where(e => e.MatchesEntirePath(Hand));

        matchingBids = lastOpponentsBid != null
            ? matchingBids.Where(e => e.Interjection == null || e.Interjection.Equals(lastOpponentsBid))
            : matchingBids.Where(e => e.Interjection == null);

        return matchingBids.ToList();
    }


    public List<BidNode> GetNextLegalBids() {
        var leftOpponentsBid = Auction.GetLastPlayerBid(Position.GetLeftOpponent(), passAsNull: true);
        var rightOpponentsBid = Auction.GetLastPlayerBid(Position.GetRightOpponent(), passAsNull: true);
        var lastOpponentsBid = rightOpponentsBid ?? leftOpponentsBid;

        var matchingBids = Head.GetNextBids().Where(e => e.IsBidLegal(Auction));
        matchingBids = lastOpponentsBid != null
            ? matchingBids.Where(e => e.Interjection == null || e.Interjection.Equals(lastOpponentsBid))
            : matchingBids.Where(e => e.Interjection == null);

        return matchingBids.ToList();
    }


    protected virtual SystemBranchResponse? GetNextBid(HashSet<InterruptedBid> confusingBids) {
        var matchingBids = GetMatchingBids();
        var legalBids = matchingBids.Where(e => e.IsBidLegal(Auction)).ToList();

        if (legalBids.Count > 0) {
            // Najpierw preferowane odzwyki, potem najmniejsza.
            var result = legalBids
                .OrderByDescending(e => e.IsPreferred ? 1 : 0)
                .ThenByDescending(e => e.Convention != null ? 1 : 0)
                .ThenBy(e => e)
                .First();

            result.IsFromSystem = true;
            return result.ToSystemResponse();
        }

        // Nie mamy legalnych odzywek pochodzących z systemu.
        // Polegamy zatem na informacjach już zebranych na tej gałęzi.
        var partnerHand = Head.Evaluate();
        var combinedHand = partnerHand.Combine(Hand);
        var settledGameColor = Head.GetDeclaredGameColor();

        // Sprawdzamy, czy ustaliliśmy kolor w licytacji i czy idzie w niego gra.
        if (settledGameColor != null) {
            return BidSettledColor(combinedHand, settledGameColor.Value).ToNaturalResponse(combinedHand, confusingBids);
        }

        // Brak ustalonego koloru w licytacji (jako OutputGameColor).
        // Pasuje coś z systemu, tylko jest nielegalne (jebani oponenci się wcieli).
        if (matchingBids.Count != 0) {
            // Próbujemy pokazać nasze zamiary naturalnie.
            // Najpierw próba poparcia jakiegoś zgłaszanego już koloru (limit 2).
            if (combinedHand.CanShowWeakColorSupport(out var supportedColor) && Auction.CanSubmit(2, supportedColor)) {
                return BidNode.Submit(2, supportedColor, "Bezpieczne pokazanie poparcia na niskim poziomie.").ToNaturalResponse(combinedHand, confusingBids);
            }

            // Próba pokazania 
            return null;
        }

        // Skończył się system, podejmujemy decyzję:
        //   a) Czy warto w ogóle proponować końcówkę?
        //   b) Czy możemy zalicytować końcówkę?
        //   c) Czy mamy szansę na grę premiową? Jeżeli tak, to jakiej konwencji chcemy użyć?
        //   d) Czy potrzebujemy dopytać partnera o asy, czy chcemy, żeby on dopytał nas?

        // Wejście w konwencje szlemowe.
        // TODO.

        // Sprawdzenie, czy nie jesteśmy na jakimś sztucznym kolorze na poziomie gry.
        if (!AssertClaimedContract(combinedHand, out var shouldBePlayedInstead)) {
            return shouldBePlayedInstead.ToNaturalResponse(combinedHand, confusingBids);
        }

        return (ClaimGame(combinedHand) ?? InviteToGame(combinedHand))?.ToNaturalResponse(combinedHand, confusingBids);
    }


    protected virtual BidNode? BidSettledColor(HandEvaluation combinedHand, BidColor settledGameColor) {
        // Jeżeli tak, to zgłaszamy w niego końcówkę.
        if (combinedHand.GoodToPlayColor(settledGameColor)) {
            return BidNode.SubmitGameOrPass(Auction, settledGameColor, "Zgłoszenie gry w kolor ustalony w licytacji.");
        }

        var currentContract = Auction.GetCurrentContractColor(out var proposedByPlayer);
        if (settledGameColor == currentContract) {
            // Gdy obecny kontrakt został zaproponowany przez przeciwników (???), to kontrujemy.
            if (proposedByPlayer != Position && proposedByPlayer != Position.GetPartner()) {
                return BidNode.Double("Co oni robią? To nasz kontrakt.");
            }

            return BidNode.Pass($"Ustalony kolor '{settledGameColor}' nie nadaje się do grania.");
        }

        return BidNode.SubmitLowest(
            Auction,
            settledGameColor,
            $"W licytacji ustalono kolor '{settledGameColor}', ale z puntków wychodzi, że nie da się tego grać. Zgłoszono go na najniższym możliwym poziomie."
        );
    }


    protected virtual BidNode? ClaimGame(HandEvaluation combinedHand) {
        // Zatwierdzanie kontraktów.
        var lastSubmit = Auction.GetLastSubmittedBid(out var bidderPosition)!;

        if (combinedHand.CanClaimColorContract(out var contractColor)) {
            if (bidderPosition != Position && bidderPosition != Position.GetPartner() && Auction.CanDouble(Position)) {
                return BidNode.Double("Kontra na mięso.");
            }

            if (lastSubmit.MakesGame()) {
                return BidNode.Pass("Już robimy grę.");
            }

            return BidNode.SubmitLowestLegalGameOrDouble(Auction, contractColor, $"Zgłoszenie pasującego koloru.");
        }

        if (combinedHand.CanClaimNoTrumpContract()) {
            if (bidderPosition != Position && bidderPosition != Position.GetPartner() && Auction.CanDouble(Position)) {
                return BidNode.Double("Kontra na mięso.");
            }

            if (lastSubmit.MakesGame()) {
                return BidNode.Pass("Już robimy grę.");
            }

            return BidNode.SubmitLowestLegalGameOrDouble(Auction, BidColor.NoTrump, $"Zgłoszenie BA (brak możliwości gry kolorowej).");
        }

        return null;
    }


    protected virtual BidNode? InviteToGame(HandEvaluation combinedHand) {
        // Inwit do BA zwracamy tylko, gdy da się go zrobić (na poziomie 2).
        // Być może mamy możliwość gry kolorowej, więc nie zwracamy pasów (gdy nie da się zrobić inwitu).
        if (combinedHand.ShouldInviteToNoTrumpGame()) {
            var inviteToNoTrump = BidNode.SubmitLowest(Auction, BidColor.NoTrump, 2, "Inwit do gry BA.");
            if (inviteToNoTrump != null) {
                return inviteToNoTrump;
            }
        }

        if (combinedHand.ShouldInviteToColorGame(out var inviteColor)) {
            return inviteColor.IsMajor()
                ? BidNode.SubmitLowest(Auction, inviteColor, 3, "Zaproszenie do gry w kolor starszy.")
                : BidNode.SubmitLowest(Auction, inviteColor, 4, "Zaproszenie do gry w kolor młodszy.");
        }

        return null;
    }


    protected virtual bool AssertClaimedContract(HandEvaluation combinedHand, out BidNode? shouldBePlayedInstead) {
        shouldBePlayedInstead = null;

        var alreadyAtGameLevel = Head.MakesGame();
        var currentContractColor = Auction.GetCurrentContractColor();

        if (!alreadyAtGameLevel || currentContractColor == null) {
            return true;
        }

        if (currentContractColor == BidColor.NoTrump && combinedHand.FitsNoTrump()) {
            return true;
        }

        if (currentContractColor != BidColor.NoTrump && combinedHand.GoodToPlayColor(currentContractColor.Value)) {
            return true;
        }

        var colorToBePlayedInstead = combinedHand.GetLowerColorBoundries().First();

        // Jak nie ma nic lepszego, to ok.
        if (colorToBePlayedInstead.Key.ToBidColor() == currentContractColor) {
            return true;
        }

        // Jeżeli grane było BA i wiemy o istnieniu 9 kartowego koloru, to go zgłaszamy.
        if (currentContractColor == BidColor.NoTrump && colorToBePlayedInstead.Value < 9) {
            return true;
        }

        shouldBePlayedInstead = BidNode.SubmitLowest(
            Auction,
            colorToBePlayedInstead.Key.ToBidColor(),
            $"Obecnie licytowany kolor nie nadawał się do zostawienia na poziomie gry."
        );
        return false;
    }


    public string Description => string.Join("\r\n", Head.GetPath().Select(e => e.Condition));


    public override string ToString() {
        return string.Join('·', Head.GetPath());
    }

}