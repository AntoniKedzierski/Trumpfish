import type { BidColor, BidType, PracticeLegalBids } from '@/api/models';
import { toNumber } from '@/api/models';
import { colorMark } from '@/features/biddingBrowser/model';

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
 * The bidding box: seven rows of levels against five denominations, then pass, double and redouble underneath. Bids the
 * auction has already climbed past stay in place, only dimmed, so the box reads the same from the first bid to the last.
 */
export function BiddingBox({ legal, disabled, onBid }: BiddingBoxProps) {
  return (
    <div className="bidding-box" role="group" aria-label="Wybór odzywki">
      {levels.map((value) => (
        denominations.map((color) => {
          const minimum = toNumber(legal.minimumLevel[color]) ?? 1;
          return (
            <BoxCell
              key={`${value}${color}`}
              label={<><span className="box-level">{value}</span><span className={`suit ${color.toLowerCase()}`}>{colorMark(color)}</span></>}
              available={!disabled && value >= minimum}
              onClick={() => onBid({ type: 'Submit', color, value })}
            />
          );
        })
      ))}

      <BoxCell label={<span className="box-pass">Pas</span>} available={!disabled} onClick={() => onBid({ type: 'Pass', color: 'NoColor', value: null })} />
      <BoxCell label={<span className="box-double">X</span>} available={!disabled && legal.canDouble} onClick={() => onBid({ type: 'Double', color: 'NoColor', value: null })} />
      <BoxCell label={<span className="box-double">XX</span>} available={!disabled && legal.canRedouble} onClick={() => onBid({ type: 'Redouble', color: 'NoColor', value: null })} />
      <span className="box-cell empty" />
      <span className="box-cell empty" />
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
