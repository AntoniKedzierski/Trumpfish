import type { ReactNode } from 'react';
import type { PlayerPosition, SimulationBid, SimulationContract, SimulationHand } from '@/api/models';
import { Auction } from './Auction';
import { ContractChip } from './BidCard';
import { Deal } from './Hand';
import './deal.css';

interface DealCardProps {
  /** Nagłówek karty: „Rozdanie 7". */
  title: string;
  /** Kto rozdaje i kto jest po partii - jedno zdanie pod tytułem. */
  meta: ReactNode;
  contract: SimulationContract;
  /** Kto gra kontrakt, dopisany za kontraktem. */
  declarer?: PlayerPosition | null;
  /** Kontrakt na wysokości gry albo wyżej dostaje akcentowaną ramkę, żeby wyróżniał się w długiej serii. */
  game?: boolean;
  error?: string | null;
  /** Wiersz pod kontraktem: siła pary, a przy prawej krawędzi komendy karty (zapisz, analizuj). */
  footnote?: ReactNode;
  hands: readonly SimulationHand[];
  bidding: readonly SimulationBid[];
  dealer: PlayerPosition;
  explain?: boolean;
  flagOffSystem?: boolean;
  awaiting?: PlayerPosition | null;
}

/**
 * Jedno rozdanie na ekranie: cztery ręce, licytacja i to, czym się skończyła.
 */
/*
 * Ta sama karta w symulacji, w ćwiczeniu z botami, w ćwiczeniu z partnerem i w zapisanych rozdaniach. Komendy przychodzą
 * z zewnątrz (`footnote`), bo to jedyne, czym te cztery widoki naprawdę się różnią - a karta rysowana czterema kopiami
 * kodu to karta, która w czterech widokach wygląda inaczej.
 */
export function DealCard({
  title,
  meta,
  contract,
  declarer,
  game = false,
  error,
  footnote,
  hands,
  bidding,
  dealer,
  explain = true,
  flagOffSystem = true,
  awaiting = null,
}: DealCardProps) {
  return (
    <article className={`deal-card${game ? ' game' : ''}`}>
      <header>
        {/* Nazwa i wiersz „rozdaje / po partii" to jedno zdanie o tym rozdaniu, więc stoją razem i razem się łamią. */}
        <div className="deal-card-name">
          <h3>{title}</h3>
          <span className="deal-meta">{meta}</span>
        </div>

        <ContractChip contract={contract} declarer={declarer} />

        {error === null || error === undefined ? null : <span className="deal-error">{error}</span>}

        {footnote === undefined ? null : <div className="deal-footnote">{footnote}</div>}
      </header>

      <Deal hands={hands} />

      <Auction bidding={bidding} dealer={dealer} explain={explain} flagOffSystem={flagOffSystem} awaiting={awaiting} />
    </article>
  );
}
