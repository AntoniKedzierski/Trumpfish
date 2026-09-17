import type { BidColor, BidType, PlayerPosition, SimulationContract } from '@/api/models';
import { toNumber } from '@/api/models';
import { DoubleMark, RedoubleMark, SuitMark } from '@/components/suits';

export interface BidCardCall {
  /** Brak typu znaczy zwykłą odzywkę - tak zapisuje je drzewko systemu, gdzie „Submit" jest domyślne. */
  type?: BidType | null;
  color?: BidColor | null;
  value?: number | string | null;
  /** Słowo zamiast rysunku, kiedy odzywka nie ma znaku: pas przychodzący z serwera pod własną nazwą. */
  label?: string | null;
}

/**
 * Jedna odzywka: wysokość i kolor, kontra, rekontra albo pas.
 */
/*
 * Jedyne miejsce, w którym odzywka jest rysowana. Były trzy: `BidMark` w `suits.tsx`, `CallMark` w drzewku systemu i
 * `BidLabel` w symulacji - każde z własnym zestawem pól wejściowych i własnym pomysłem na to, co zrobić z pasem. Trzy
 * rysunki tej samej rzeczy to trzy okazje, żeby znak wypadł o piksel wyżej w jednym widoku niż w drugim.
 *
 * Kolorowany jest sam znak; wysokość, pas, kontra i rekontra zostają w domyślnej barwie tekstu.
 */
export function BidCard({ bid }: { bid: BidCardCall }) {
  const { type, color, value, label } = bid;

  if (type === 'Double') {
    return (
      <span className="bid-call">
        <DoubleMark />
      </span>
    );
  }

  if (type === 'Redouble') {
    return (
      <span className="bid-call">
        <RedoubleMark />
      </span>
    );
  }

  if (type !== undefined && type !== null && type !== 'Submit') {
    return <>{label ?? 'Pas'}</>;
  }

  return (
    <span className="bid-call">
      <span className="bid-level">{toNumber(value) ?? ''}</span>
      <SuitMark suit={color ?? 'NoColor'} />
    </span>
  );
}

/** Kontrakt, w którym rozdanie stanęło - rysowany jak odzywka, a nie brany jako tekst z serwera. */
export function Contract({ contract }: { contract: SimulationContract }) {
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

/**
 * Kontrakt jako płytka nagłówka: rysunek kontraktu i miejsce, które go gra.
 */
/*
 * Karta rozdania i powtórzona licytacja pokazują dokładnie to samo, więc pokazują to jedną kontrolką. Dwa razy
 * napisany ten sam ciąg klas to dwa miejsca, w których płytka może przestać wyglądać tak samo.
 */
export function ContractChip({ contract, declarer }: { contract: SimulationContract; declarer?: PlayerPosition | null }) {
  return (
    <span className={contract.passed ? 'ui-chip deal-contract passed' : 'ui-chip deal-contract'}>
      <Contract contract={contract} />
      {declarer === null || declarer === undefined ? '' : ` ${declarer}`}
    </span>
  );
}
