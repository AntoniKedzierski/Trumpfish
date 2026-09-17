import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PlayerPosition, SimulationBid } from '@/api/models';
import { playerPositions, toNumber } from '@/api/models';
import { horizontalNudge } from '../keepOnScreen';
import { BidCard } from './BidCard';
import './deal.css';

interface AuctionProps {
  bidding: readonly SimulationBid[];
  dealer: PlayerPosition;
  /** Czy odzywkę można kliknąć, żeby zobaczyć, co znaczyła. Wyłączone, dopóki licytacja toczy się w ciemno. */
  explain?: boolean;
  /** Czy odzywki wymyślone poza systemem są oznaczane. Wyłączone na żywo, gdzie zdradzałoby to odpowiedź. */
  flagOffSystem?: boolean;
  /** Miejsce, które jeszcze nie odezwało - pusta komórka pokazuje, na kogo czekamy. */
  awaiting?: PlayerPosition | null;
}

/** Licytacja jako klasyczna tabela czterech kolumn: jedna na miejsce przy stole, zaczynając pod rozdającym. */
export function Auction({ bidding, dealer, explain = true, flagOffSystem = true, awaiting = null }: AuctionProps) {
  // Naraz otwarte jest jedno wyjaśnienie, kluczowane numerem odzywki w licytacji.
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (bidding.length === 0 && awaiting === null) {
    return <p className="bidding-empty">Brak licytacji.</p>;
  }

  // Licytacja zawsze zaczyna się od rozdającego, więc puste komórki trzymają każdą odzywkę pod właściwą kolumną.
  const offset = playerPositions.indexOf(dealer);
  const cells: (SimulationBid | null)[] = Array.from({ length: offset }, () => null);
  bidding.forEach((bid) => cells.push(bid));

  // Zaznaczona komórka musi istnieć, więc kolejka wypadająca na świeży wiersz otwiera ten wiersz, zamiast wisieć poza tabelą.
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

/** Odzywka odpowiada na wskaźnik i po kliknięciu pokazuje, skąd się wzięła; te spoza systemu dostają kropkę. */
function BidCell({ bid, explain, flagOffSystem, open, onToggle, onClose }: BidCellProps) {
  const container = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);

  /*
   * Dymek jest wyśrodkowany pod swoją odzywką, co dla pierwszej i ostatniej kolumny wypycha jego połowę poza to, co
   * widać. Mierzony raz przy otwarciu - przesunięcie jest wtedy zerowe, więc mierzone jest położenie niepoprawione - i
   * cofany o tyle, ile wystaje. Granicę wyznacza `keepOnScreen`: okno i każda przewijana ramka nad dymkiem.
   */
  useLayoutEffect(() => {
    if (!open || bubble.current === null) {
      setShift(0);
      return;
    }

    setShift(horizontalNudge(bubble.current));
  }, [open]);

  // Pas nigdy nie jest naprawdę „spoza systemu", więc oznaczanie go dokładałoby tabeli tylko szumu.
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
        <BidCard bid={bid} />
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
