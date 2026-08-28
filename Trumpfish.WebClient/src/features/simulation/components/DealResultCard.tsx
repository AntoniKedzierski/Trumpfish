import { useEffect, useRef, useState } from 'react';
import { cardLabel, suitOfCard } from '../deals';
import { makesGame } from '../sorting';
import { colorMark } from '@/features/biddingBrowser/model';
import type { SimulationBid, SimulationContract, SimulationDealResult, SimulationHand, PlayerPosition } from '@/api/models';
import { cardColors, cardValues, playerPositions, toNumber } from '@/api/models';

const positionLabels: Record<PlayerPosition, string> = { North: 'N', East: 'E', South: 'S', West: 'W' };

interface DealResultCardProps {
  deal: SimulationDealResult;
}

/** One simulated deal: the four hands with their point counts plus the auction as a classic four column table. */
export function DealResultCard({ deal }: DealResultCardProps) {
  const hands = new Map(deal.hands.map((hand) => [hand.position, hand]));

  return (
    <article className={`deal-card${makesGame(deal.contract) ? ' game' : ''}`}>
      <header>
        <h3>Rozdanie {(toNumber(deal.index) ?? 0) + 1}</h3>
        <span className="deal-meta">Rozdaje {deal.dealer}</span>
        <span className={`deal-contract${deal.contract.passed ? ' passed' : ''}`}>
          {deal.contract.label}
          {deal.contract.declarer === null || deal.contract.declarer === undefined ? '' : ` · ${deal.contract.declarer}`}
        </span>
        {deal.error === null || deal.error === undefined ? null : <span className="deal-error">{deal.error}</span>}
        <ContractSummary contract={deal.contract} />
      </header>

      <div className="hands">
        {playerPositions.map((position) => {
          const hand = hands.get(position);
          return hand === undefined ? null : <HandView key={position} hand={hand} />;
        })}
      </div>

      <BiddingTable deal={deal} />
    </article>
  );
}

function ContractSummary({ contract }: { contract: SimulationContract }) {
  const pairPoints = toNumber(contract.pairPoints);
  if (contract.passed || pairPoints === null) {
    return null;
  }

  // A no-trump contract is summarised with NT points only, a suit contract also shows how many trumps the pair holds.
  const trumpCount = toNumber(contract.trumpCount);
  const noTrump = contract.color === 'NoTrump';

  return (
    <span className="deal-summary">
      Para gra na {pairPoints} {noTrump ? 'PC bez atu.' : 'PC'}
      {trumpCount === null ? '' : ' z '}
      {trumpCount === null ? null : (
        <>
          {trumpCount} kartami.
        </>
      )}
    </span>
  );
}

function HandView({ hand }: { hand: SimulationHand }) {
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
            <span className={suitOfCard(color)}>{suitMark(color)}</span>
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

function BiddingTable({ deal }: { deal: SimulationDealResult }) {
  // Only one explanation popup is open at a time, keyed by the index of the bid inside the auction.
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (deal.bidding.length === 0) {
    return <p className="bidding-empty">Brak licytacji.</p>;
  }

  // The auction always starts with the dealer, so blank cells keep every bid under the right column.
  const offset = playerPositions.indexOf(deal.dealer);
  const cells: (SimulationBid | null)[] = Array.from({ length: offset }, () => null);
  deal.bidding.forEach((bid) => cells.push(bid));
  while (cells.length % 4 !== 0) {
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
              <td key={column} className={bid === null ? 'empty' : ''}>
                {bid === null ? '' : (
                  <BidCell
                    bid={bid}
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

interface BidCellProps {
  bid: SimulationBid;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}

/** A bid reacts to the pointer and reveals the engine's reasoning on click; bids invented outside the system get a small dot. */
function BidCell({ bid, open, onToggle, onClose }: BidCellProps) {
  const container = useRef<HTMLSpanElement>(null);

  // A pass is never really "outside the system", so flagging it would only add noise to the table.
  const offSystem = !bid.isFromSystem && bid.type !== 'Pass';

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
      <button type="button" className={`bid-chip${offSystem ? ' off-system' : ''}${open ? ' open' : ''}`} onClick={onToggle}>
        <BidLabel bid={bid} />
        {offSystem ? <span className="off-system-dot" title="Odzywka spoza systemu" /> : null}
      </button>
      {open ? (
        <span className="bid-explanation" role="tooltip">
          <span className="bid-explanation-title">
            {bid.bidder} · {bid.isFromSystem ? 'z systemu' : 'spoza systemu'}
          </span>
          <span className="bid-explanation-text">{bid.explanation ?? 'Brak wyjaśnienia.'}</span>
        </span>
      ) : null}
    </span>
  );
}

/** Only the suit glyph is tinted - levels, Pass, X and XX stay in the default text colour. */
function BidLabel({ bid }: { bid: SimulationBid }) {
  if (bid.type !== 'Submit') {
    return <>{bid.label}</>;
  }

  return (
    <>
      {toNumber(bid.value) ?? ''}
      <span className={`suit ${bid.color.toLowerCase()}`}>{colorMark(bid.color)}</span>
    </>
  );
}

function suitMark(color: (typeof cardColors)[number]): string {
  return cardLabel({ value: 'Two', color }).slice(-1);
}
