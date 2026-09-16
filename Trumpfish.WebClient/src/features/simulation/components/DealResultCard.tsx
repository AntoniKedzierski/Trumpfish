import type { BidColor, SimulationContract, SimulationDealResult } from '@/api/models';
import { playerPositions, toNumber } from '@/api/models';
import { SaveDealButton } from '@/features/savedDeals/SaveDealButton';
import { makesGame } from '../sorting';
import { vulnerabilityLabels, vulnerabilityOf } from '../vulnerability';
import { DealAnalysis } from './DealAnalysis';
import { BiddingTable, ContractLabel, HandView } from './DealViews';

interface DealResultCardProps {
  deal: SimulationDealResult;
}

/** One finished deal: the four hands with their point counts plus the auction as a classic four column table. */
export function DealResultCard({ deal }: DealResultCardProps) {
  const hands = new Map(deal.hands.map((hand) => [hand.position, hand]));

  // The board's own number decides who is vulnerable, the way it does at a tournament.
  const board = toNumber(deal.index) ?? 0;
  const vulnerability = vulnerabilityOf(board);

  return (
    <article className={`deal-card${makesGame(deal.contract) ? ' game' : ''}`}>
      <header>
        <h3>Rozdanie {board + 1}</h3>
        <span className="deal-meta">
          Rozdaje {deal.dealer} · po partii {vulnerabilityLabels[vulnerability]}
        </span>

        <span className={`deal-contract${deal.contract.passed ? ' passed' : ''}`}>
          <ContractLabel contract={deal.contract} />
          {deal.contract.declarer === null || deal.contract.declarer === undefined ? '' : ` ${deal.contract.declarer}`}
        </span>

        {deal.error === null || deal.error === undefined ? null : <span className="deal-error">{deal.error}</span>}

        <div className="deal-footnote">
          <ContractSummary contract={deal.contract} />
          {/* Both sit at the far end of the row, the quiet one first: keeping a deal is a note to self, analysing it is the errand. */}
          <SaveDealButton deal={deal} vulnerability={vulnerability} />
          <DealAnalysis deal={deal} vulnerability={vulnerability} />
        </div>
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

/**
 * The trump suit in the instrumental case, which is what "z dziewięcioma ..." asks for. Plural covers every count a
 * contract can really have; the singular is there so that a one card fit does not come out as broken Polish.
 */
const trumpWords: Partial<Record<BidColor, { one: string; many: string }>> = {
  Clubs: { one: 'treflem', many: 'treflami' },
  Diamonds: { one: 'karem', many: 'karami' },
  Hearts: { one: 'kierem', many: 'kierami' },
  Spades: { one: 'pikiem', many: 'pikami' },
};

export function ContractSummary({ contract }: { contract: SimulationContract }) {
  const pairPoints = toNumber(contract.pairPoints);
  if (contract.passed || pairPoints === null) {
    return null;
  }

  // A no-trump contract is summarised with NT points only, a suit contract also names the suit its trumps are in.
  const noTrump = contract.color === 'NoTrump';
  const trumpCount = noTrump ? null : toNumber(contract.trumpCount);
  const trumps = trumpWords[contract.color];

  return (
    <span className="deal-summary">
      Para gra na {pairPoints} {noTrump ? 'PC bez atu.' : 'PC'}
      {trumpCount === null ? '' : ` z ${trumpCount} ${trumps === undefined ? 'kartami' : trumpCount === 1 ? trumps.one : trumps.many}.`}
    </span>
  );
}
