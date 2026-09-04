import type { SimulationContract, SimulationDealResult } from '@/api/models';
import { playerPositions, toNumber } from '@/api/models';
import { makesGame } from '../sorting';
import { BiddingTable, HandView } from './DealViews';

interface DealResultCardProps {
  deal: SimulationDealResult;
}

/** One finished deal: the four hands with their point counts plus the auction as a classic four column table. */
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

      <BiddingTable bidding={deal.bidding} dealer={deal.dealer} />
    </article>
  );
}

export function ContractSummary({ contract }: { contract: SimulationContract }) {
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
