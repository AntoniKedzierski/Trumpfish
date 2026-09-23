import type { BidColor, SimulationContract, SimulationDealResult } from '@/api/models';
import { toNumber } from '@/api/models';
import { SaveDealButton } from '@/features/savedDeals/SaveDealButton';
import { DealCard } from '@/ui';
import { makesGame } from '../sorting';
import { vulnerabilityLabels, vulnerabilityOf } from '../vulnerability';
import { DealAnalysis } from './DealAnalysis';

/**
 * Jedno rozdanie z symulacji: wspólna karta rozdania plus komendy, które ma tylko ten widok.
 *
 * `analyseWithSystemId` podaje tylko symulacja - to ona ma na ekranie wynik, którego nie wolno zgubić, więc tylko ona
 * oferuje zapisanie rozdania razem z otwarciem analizy w nowej karcie.
 */
export function DealResultCard({ deal, analyseWithSystemId }: { deal: SimulationDealResult; analyseWithSystemId?: string }) {
  // Numer rozdania decyduje, kto jest po partii - tak samo jak na turnieju.
  const board = toNumber(deal.index) ?? 0;
  const vulnerability = vulnerabilityOf(board);

  return (
    <DealCard
      title={`Rozdanie ${board + 1}`}
      meta={`Rozdaje ${deal.dealer} · po partii ${vulnerabilityLabels[vulnerability]}`}
      contract={deal.contract}
      declarer={deal.contract.declarer}
      game={makesGame(deal.contract)}
      error={deal.error}
      hands={deal.hands}
      bidding={deal.bidding}
      dealer={deal.dealer}
      footnote={
        <>
          <ContractSummary contract={deal.contract} />
          {/* Oba przy prawej krawędzi, ciche pierwsze: zapisanie rozdania to notatka dla siebie, analiza to sprawa, po którą ktoś przyszedł. */}
          <SaveDealButton deal={deal} vulnerability={vulnerability} analyseWithSystemId={analyseWithSystemId} />
          <DealAnalysis deal={deal} vulnerability={vulnerability} />
        </>
      }
    />
  );
}

/**
 * Kolor atutowy w narzędniku, o który prosi „z dziewięcioma ...". Liczba mnoga pokrywa każdą liczbę, jaką kontrakt
 * naprawdę może mieć; pojedyncza jest po to, żeby fit z jedną kartą nie wyszedł łamaną polszczyzną.
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

  // Kontrakt bezatutowy podsumowuje się samymi punktami NT, kolorowy nazywa też kolor, w którym leżą atuty.
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
