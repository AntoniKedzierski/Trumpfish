import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PlayerPosition, SimulationBid, SimulationContract, SimulationHand } from '@/api/models';
import { cardColors, cardValues, playerPositions, toNumber } from '@/api/models';
import { DoubleMark, RedoubleMark, SuitMark } from '@/components/suits';
import { cardLabel, positionLabels } from '../deals';
import './deal.css';

/** One hand as four suit rows, with its point count and shape. */
export function HandView({ hand }: { hand: SimulationHand }) {
  return (
    <div className="hand">
      <div className="hand-header">
        <span className="hand-position">{positionLabels[hand.position]}</span>
        <span className="hand-points" title="Punkty honorowe / punkty w grze bezatutowej">
          {hand.points} PC · {hand.pointsNt} NT
        </span>
        <span className="hand-shape">
          {hand.spades}-{hand.hearts}-{hand.diamonds}-{hand.clubs}
        </span>
      </div>

      <ul className="hand-suits">
        {[...cardColors].reverse().map((color) => (
          <li key={color}>
            {/* The mark is wrapped so that the row lines up two pieces of text rather than a piece of text and a picture. */}
            <span className="hand-suit">
              <SuitMark suit={color} />
            </span>
            <span className="hand-cards">
              {hand.cards
                .filter((card) => card.color === color)
                .sort((left, right) => cardValues.indexOf(right.value) - cardValues.indexOf(left.value))
                .map((card) => cardLabel(card).slice(0, -1))
                .join(' ') || '—'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface BiddingTableProps {
  bidding: readonly SimulationBid[];
  dealer: PlayerPosition;
  /** Whether a bid can be clicked to reveal what it meant. Off while an auction is still being played out blind. */
  explain?: boolean;
  /** Whether bids the engine invented outside the system are marked. Off during a live auction, where that would give the game away. */
  flagOffSystem?: boolean;
  /** Seat that still owes a bid, marked with an empty cell so the table shows whose turn it is. */
  awaiting?: PlayerPosition | null;
}

/** The auction as the classic four column table: one column per seat, starting under the dealer. */
export function BiddingTable({ bidding, dealer, explain = true, flagOffSystem = true, awaiting = null }: BiddingTableProps) {
  // Only one explanation popup is open at a time, keyed by the index of the bid inside the auction.
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (bidding.length === 0 && awaiting === null) {
    return <p className="bidding-empty">Brak licytacji.</p>;
  }

  // The auction always starts with the dealer, so blank cells keep every bid under the right column.
  const offset = playerPositions.indexOf(dealer);
  const cells: (SimulationBid | null)[] = Array.from({ length: offset }, () => null);
  bidding.forEach((bid) => cells.push(bid));

  // The marked cell has to exist, so a turn falling on a fresh row opens that row rather than hanging off the table.
  const turn = awaiting === null ? -1 : cells.length;
  while (cells.length <= turn || cells.length % 4 !== 0 || cells.length === 0) {
    cells.push(null);
  }

  return (
    <table className="bidding-table">
      <thead>
        <tr>
          {playerPositions.map((position) => (
            <th key={position}>{position}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: cells.length / 4 }, (_, row) => (
          <tr key={row}>
            {cells.slice(row * 4, row * 4 + 4).map((bid, column) => (
              <td key={column} className={cellClass(bid, row * 4 + column === turn)}>
                {bid === null ? '' : (
                  <BidCell
                    bid={bid}
                    explain={explain}
                    flagOffSystem={flagOffSystem}
                    open={openIndex === (toNumber(bid.index) ?? -1)}
                    onToggle={() => {
                      const index = toNumber(bid.index) ?? -1;
                      setOpenIndex((current) => (current === index ? null : index));
                    }}
                    onClose={() => setOpenIndex(null)}
                  />
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function cellClass(bid: SimulationBid | null, awaited: boolean): string {
  return [bid === null ? 'empty' : '', awaited ? 'awaiting' : ''].filter((name) => name !== '').join(' ');
}

interface BidCellProps {
  bid: SimulationBid;
  explain: boolean;
  flagOffSystem: boolean;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}

/** A bid reacts to the pointer and reveals the reasoning behind it on click; bids invented outside the system get a small dot. */
function BidCell({ bid, explain, flagOffSystem, open, onToggle, onClose }: BidCellProps) {
  const container = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);

  /*
   * The popup is centred under its bid, which puts half of it past the edge of the screen for a bid in the first or last
   * column. Measured once on opening - the shift is zero at that moment, so what is measured is the unnudged position -
   * and moved back by however much is hanging out.
   */
  useLayoutEffect(() => {
    if (!open || bubble.current === null) {
      setShift(0);
      return;
    }

    const margin = 8;
    const box = bubble.current.getBoundingClientRect();
    if (box.left < margin) {
      setShift(Math.round(margin - box.left));
    } else if (box.right > window.innerWidth - margin) {
      setShift(Math.round(window.innerWidth - margin - box.right));
    }
  }, [open]);

  // A pass is never really "outside the system", so flagging it would only add noise to the table.
  const offSystem = flagOffSystem && !bid.isFromSystem && bid.type !== 'Pass';

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  return (
    <span className="bid-cell" ref={container}>
      <button
        type="button"
        className={`bid-chip${bid.type === 'Pass' ? ' pass' : ''}${offSystem ? ' off-system' : ''}${open ? ' open' : ''}`}
        disabled={!explain}
        onClick={onToggle}
      >
        <BidLabel bid={bid} />
        {offSystem ? <span className="off-system-dot" title="Odzywka spoza systemu" /> : null}
      </button>
      {open ? (
        <span
          className="bid-explanation"
          role="tooltip"
          ref={bubble}
          style={{ '--bid-shift': `${shift}px` } as React.CSSProperties}
        >
          <span className="bid-explanation-title">
            {bid.bidder}
            {flagOffSystem ? ` · ${bid.isFromSystem ? 'z systemu' : 'spoza systemu'}` : ''}
          </span>
          <span className="bid-explanation-text">{bid.explanation ?? 'Brak wyjaśnienia.'}</span>
        </span>
      ) : null}
    </span>
  );
}

/** Only the suit mark is tinted - the level, Pass, the double and the redouble stay in the default text colour. */
export function BidLabel({ bid }: { bid: Pick<SimulationBid, 'type' | 'color' | 'value' | 'label'> }) {
  if (bid.type === 'Double') {
    return (
      <span className="bid-call">
        <DoubleMark />
      </span>
    );
  }

  if (bid.type === 'Redouble') {
    return (
      <span className="bid-call">
        <RedoubleMark />
      </span>
    );
  }

  if (bid.type !== 'Submit') {
    return <>{bid.label}</>;
  }

  return (
    <span className="bid-call">
      <span className="bid-level">{toNumber(bid.value) ?? ''}</span>
      <SuitMark suit={bid.color} />
    </span>
  );
}

/** The contract a deal ended in, drawn the same way a bid is rather than taken as the server's text. */
export function ContractLabel({ contract }: { contract: SimulationContract }) {
  if (contract.passed) {
    return <>{contract.label}</>;
  }

  return (
    <span className="bid-call">
      <span className="bid-level">{toNumber(contract.value) ?? ''}</span>
      <SuitMark suit={contract.color} />
      {contract.isRedoubled ? <RedoubleMark /> : contract.isDoubled ? <DoubleMark /> : null}
    </span>
  );
}
