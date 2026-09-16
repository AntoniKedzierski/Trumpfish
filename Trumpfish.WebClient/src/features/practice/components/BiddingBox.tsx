import type { BidColor, BidType, PracticeLegalBids } from '@/api/models';
import { toNumber } from '@/api/models';
import { DoubleMark, RedoubleMark } from '@/components/suits';
import { BidCard } from '@/ui';

/** Columns of the box, ordered the way the denominations rank: ♣ < ♦ < ♥ < ♠ < NT. */
const denominations: readonly BidColor[] = ['Clubs', 'Diamonds', 'Hearts', 'Spades', 'NoTrump'];

const levels: readonly number[] = [1, 2, 3, 4, 5, 6, 7];

export interface BoxBid {
  type: BidType;
  color: BidColor;
  value: number | null;
}

interface BiddingBoxProps {
  legal: PracticeLegalBids;
  disabled: boolean;
  onBid: (bid: BoxBid) => void;
}

/**
 * The bidding box: pass, double and redouble on the first row, then seven rows of levels against five denominations. Bids
 * the auction has already climbed past stay in place, only dimmed, so the box reads the same from the first bid to the last.
 */
/*
 * The three calls that answer an auction rather than raise it used to sit under all thirty five bids, which put the most
 * pressed control on the whole screen at the end of a scroll. They are the first row now.
 *
 * Every cell draws its call through the shared `BidCard`, so a bid here is the same drawing, at the same size and with the
 * same gap after the digit, as the one in the auction table underneath and in the system tree.
 */
export function BiddingBox({ legal, disabled, onBid }: BiddingBoxProps) {
  return (
    <div className="bidding-box" role="group" aria-label="Wybór odzywki">
      <BoxCell label={<span className="box-pass">Pas</span>} available={!disabled} onClick={() => onBid({ type: 'Pass', color: 'NoColor', value: null })} />
      <BoxCell label={<span className="bid-call"><DoubleMark className="box-double" /></span>} available={!disabled && legal.canDouble} onClick={() => onBid({ type: 'Double', color: 'NoColor', value: null })} />
      <BoxCell label={<span className="bid-call"><RedoubleMark className="box-double" /></span>} available={!disabled && legal.canRedouble} onClick={() => onBid({ type: 'Redouble', color: 'NoColor', value: null })} />
      <span className="box-cell empty" />
      <span className="box-cell empty" />

      {levels.map((value) => (
        denominations.map((color) => {
          const minimum = toNumber(legal.minimumLevel[color]) ?? 1;
          return (
            <BoxCell
              key={`${value}${color}`}
              label={<BidCard bid={{ color, value }} />}
              available={!disabled && value >= minimum}
              onClick={() => onBid({ type: 'Submit', color, value })}
            />
          );
        })
      ))}
    </div>
  );
}

function BoxCell({ label, available, onClick }: { label: React.ReactNode; available: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`box-cell${available ? '' : ' unavailable'}`} disabled={!available} onClick={onClick}>
      {label}
    </button>
  );
}
