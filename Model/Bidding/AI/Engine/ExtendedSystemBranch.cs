using Model.Bidding.AI.Eval;
using Model.Bidding.Bids;
using Model.Enums;
using Model.Helpers;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Model.Bidding.AI.Engine;

public class ExtendedSystemBranch : SystemBranch {

    private List<InterruptedBid> _offSystemBids;

    private HandEvaluation _partnersHand;

    public override bool OnlySystem => _offSystemBids.Count == 0;

    public InterruptedBid HeadOffSystem => _offSystemBids.Last();

    public override Bid Result => HeadOffSystem;


    public ExtendedSystemBranch(InterruptedBid offSystemBid, SystemBranch baseBranch) : base(baseBranch) {
        _offSystemBids = [offSystemBid];
        _partnersHand = baseBranch.Head.Evaluate();
    }


    protected override SystemBranchResponse? GetNextBid(HashSet<InterruptedBid> confusingBids) {
        var combinedHand = _partnersHand.Combine(Hand);

        // Rozpoznanie inwitu.
        if (RecognizeInvite(out var inviteColor)) {
            // Poniższe metody mogą zaakceptować, odrzucić (pas) lub przebić inwit (inny kolor).
            return inviteColor == BidColor.NoTrump 
                ? ResponseNoTrumpInvite(combinedHand)?.ToNaturalResponse(combinedHand) 
                : ResponseColorInvite(combinedHand, inviteColor)?.ToNaturalResponse(combinedHand);
        }

        return GetForcedBid(combinedHand)?.ToNaturalResponse(combinedHand);
    }


    /// <summary>
    /// Sprawdza, czy ostatnia odzywka była inwitem.
    /// </summary>
    private bool RecognizeInvite(out BidColor inviteColor) {
        inviteColor = BidColor.NoColor;

        if (_offSystemBids.Count == 0) {
            return false;
        }

        if (HeadOffSystem.Type != BidType.Submit) {
            return false;
        }

        inviteColor = HeadOffSystem.Color;

        // Odzywki niedeklarujące gry uznajemy za inwity.
        if (!HeadOffSystem.MakesGame()) {
            return true;
        }

        // Natomiast wszystko co robi grę może być inwitem, jeżeli zostało dane po odzywce robiącej grę (zmiana kontraktu).
        return _offSystemBids.Count == 1
            ? HeadOffSystem.MakesGame() && Head.MakesGame()
            : HeadOffSystem.MakesGame() && _offSystemBids[^2].MakesGame();
    }


    private BidNode? ResponseNoTrumpInvite(HandEvaluation combinedHand) {
        // 1. Akceptacja inwitu, jeżeli możemy.
        if (combinedHand.FitsNoTrump()) {
            return BidNode.SubmitLowestLegalGameOrDouble(Auction, BidColor.NoTrump, "Akceptacja inwitu do BA.");
        }

        // 2. Zagranie końcówki w kolor, jeżeli możemy.
        if (combinedHand.CanClaimColorContract(out var color)) {
            return BidNode.SubmitLowestLegalGameOrDouble(Auction, color, "Zagranie gry w kolor.");
        }

        // 3. Inwit do gry kolorowej.
        if (combinedHand.ShouldInviteToColorGame(out var colorInvite)) {
            // Próg zależny od minimalnych punktów.
            if (combinedHand.Points >= 25) {
                return BidNode.SubmitLowest(Auction, colorInvite, colorInvite.IsMajor() ? 3 : 4, "Zaproponowanie gry w kolor.");
            }

            if (combinedHand.Points >= 23) {
                return BidNode.SubmitLowest(Auction, colorInvite, 3, "Zaproponowanie gry w kolor.");
            }

            if (combinedHand.Points >= 21) {
                return BidNode.SubmitLowest(Auction, colorInvite, 2, "Zaproponowanie gry w kolor.");
            }
        }

        return GetForcedBid(combinedHand);
    }


    private BidNode? ResponseColorInvite(HandEvaluation combinedHand, BidColor proposedColor) {
        // 1. Akceptacja inwitu, jeżeli możemy.
        if (combinedHand.GoodToPlayColor(proposedColor)) {
            return BidNode.SubmitLowestLegalGameOrDouble(Auction, proposedColor, "Zaakceptowanie inwitu.");
        }

        // 2. Po prostu zagranie BA, jeżeli wchodzi nam, że możemy.
        if (combinedHand.CanClaimNoTrumpContract()) {
            return BidNode.SubmitLowestLegalGameOrDouble(Auction, BidColor.NoTrump, "Po prostu wychodzi BA z punktów.");
        }

        // 3. Propozycja BA w zamian (zależnie od wysokości odzywki).
        if (combinedHand.ShouldInviteToNoTrumpGame()) {
            var result = BidNode.SubmitLowest(Auction, BidColor.NoTrump, 2, "Propozycja BA, gdyż nie można zaakceptować inwitu do gry kolorowej.");

            // Wyjście z tego bloku robimy, gdy nie da się zalicytować BA na poziomie 2.
            if (result != null) {
                return result;
            }
        }

        // 4. Gdy mamy punkty na końcówkę (25 PC+), to swobodnie proponujemy własny kolor.
        if (combinedHand.Points >= 25 && combinedHand.ShouldInviteToColorGame(out var inviteColor) && inviteColor != proposedColor) {
            return inviteColor.IsMajor()
                ? BidNode.SubmitLowest(Auction, inviteColor, 3, "Propozycja gry w inny kolor starszy.")
                : BidNode.SubmitLowest(Auction, inviteColor, 4, "Propozycja gry w inny kolor młodszy.");
        }

        return GetForcedBid(combinedHand);
    }


    public override string ToString() {
        if (_offSystemBids.Count == 0) {
            return base.ToString();
        }

        return base.ToString() + "·(" + string.Join("·", _offSystemBids.Select(e => $"{e}")) + ")";
    }
}
