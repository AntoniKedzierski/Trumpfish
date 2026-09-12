import { useState } from 'react';
import { solveDoubleDummy } from '@/api/analysis';
import type {
  BidColor,
  DoubleDummyBestContract,
  DoubleDummyBid,
  DoubleDummyCell,
  BiddingMiss,
  DoubleDummyDifference,
  DoubleDummyPlayed,
  DoubleDummyResponse,
  Pair,
  SimulationDealResult,
  Vulnerability,
} from '@/api/models';
import { playerPositions, toNumber } from '@/api/models';
import { SuitMark } from '@/components/suits';
import { useDisclosure } from '@/components/useDisclosure';
import { pairLabels } from '../vulnerability';
import './DealAnalysis.css';

/**
 * What a pair could have done instead. The server only ever names something that was actually on offer, so every one of
 * these is a fair thing to say to somebody who was at the table.
 */
const missLabels: Record<NonNullable<BiddingMiss>, string> = {
  None: '',
  CouldHaveBid: 'mogli wylicytować',
  Overbid: 'przelicytowane',
  CouldHaveDoubled: 'mogli skontrować',
  ShouldNotHaveDoubled: 'mogli nie kontrować',
};

/** The five denominations in bidding order, which is the order the trick table is read in. */
const denominations: readonly BidColor[] = ['Clubs', 'Diamonds', 'Hearts', 'Spades', 'NoTrump'];

/**
 * What the deal was really worth, asked for one board at a time.
 */
/*
 * Solving a board is the most expensive thing the server does, so nothing is analysed until somebody asks. Once an answer
 * is in, the button that asked for it becomes the way back into it: there is nothing left to request, and the answer is
 * far too big to leave sitting in the header.
 */
export function DealAnalysis({ deal, vulnerability }: { deal: SimulationDealResult; vulnerability: Vulnerability }) {
  const [analysis, setAnalysis] = useState<DoubleDummyResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { open, setOpen, root, trigger } = useDisclosure<HTMLSpanElement>();

  const analyse = () => {
    setBusy(true);
    setError(null);

    solveDoubleDummy({
      deal: { dealer: deal.dealer, hands: deal.hands.map(({ position, cards }) => ({ position, cards })) },
      vulnerability,
      // Sent so the analysis can say what the auction cost. Everything else comes back with or without it.
      contract: playedContract(deal),
    })
      .then((solved) => {
        setAnalysis(solved);
        // Nobody presses Analizuj without wanting to read the answer, so it opens itself.
        setOpen(true);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => setBusy(false));
  };

  /*
   * The wrapper is always here, whichever of the three states is showing. It is what the row aligns against, so a button
   * that rendered bare would sit wherever the text before it happened to end.
   */
  return (
    <span className="deal-analysis" ref={root}>
      {error !== null ? (
        <span className="deal-chip failed" title={error}>
          Analiza niedostępna
        </span>
      ) : analysis === null ? (
        <button type="button" className="deal-chip deal-analyse" disabled={busy} onClick={analyse}>
          {busy ? 'Analizuję…' : 'Analizuj…'}
        </button>
      ) : (
        <>
          <button
            type="button"
            ref={trigger}
            className="deal-chip deal-analyse"
            aria-expanded={open}
            onClick={() => setOpen((was) => !was)}
          >
            Analiza
          </button>

          {!open ? null : <AnalysisPanel analysis={analysis} />}
        </>
      )}
    </span>
  );
}

/** The contract the auction bought, in the shape the endpoint takes. Undefined on a board that was passed out. */
function playedContract(deal: SimulationDealResult): DoubleDummyBid | undefined {
  const contract = deal.contract;
  const level = toNumber(contract.value);

  if (contract.passed || level === null || contract.declarer === null || contract.declarer === undefined) {
    return undefined;
  }

  return {
    declarer: contract.declarer,
    level,
    color: contract.color,
    isDoubled: contract.isDoubled,
    isRedoubled: contract.isRedoubled,
  };
}

function AnalysisPanel({ analysis }: { analysis: DoubleDummyResponse }) {
  const par = toNumber(analysis.parScore) ?? 0;
  const best = [analysis.bestNs, analysis.bestEw].filter(
    (entry): entry is DoubleDummyBestContract => entry !== null && entry !== undefined,
  );

  const differences = [analysis.diffNs, analysis.diffEw].filter(
    (entry): entry is DoubleDummyDifference => entry !== null && entry !== undefined,
  );

  return (
    <div className="deal-analysis-panel">
      <dl className="deal-analysis-facts">
        <dt>Wartość kontraktu</dt>
        <dd>{par === 0 ? '0' : `${Math.abs(par)} dla ${par > 0 ? pairLabels.NorthSouth : pairLabels.EastWest}`}</dd>

        <dt>Kto powinien grać</dt>
        <dd>
          {analysis.parPair === null || analysis.parPair === undefined
            ? 'Obojętnie kto gra'
            : `Powinni grać ${pairName(analysis.parPair)}`}
        </dd>
      </dl>

      {differences.length === 0 ? null : (
        <section className="deal-analysis-section">
          <h4>Różnica z licytacją</h4>
          <ul>
            {differences.map((difference) => (
              <li key={difference.pair ?? ''}>
                <span className="deal-analysis-pair">{pairName(difference.pair)}</span>
                <span className="deal-analysis-note">{explain(difference, analysis.played)}</span>
                <span className={points(toNumber(difference.points) ?? 0)}>
                  {(toNumber(difference.points) ?? 0) === 0 ? 'bez różnicy' : signed(toNumber(difference.points) ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {best.length === 0 ? null : (
        <section className="deal-analysis-section">
          <h4>Najlepszy kontrakt</h4>
          <ul>
            {best.map((contract) => (
              <li key={contract.pair ?? ''}>
                <span className="deal-analysis-pair">{pairName(contract.pair)}</span>
                <Contract level={toNumber(contract.level)} color={contract.color} />
                {/* On a defence the contract is the opponents', so the seat would read as this pair's and mislead. */}
                {contract.isDefence ? (
                  <span className="deal-analysis-note">obrona</span>
                ) : (
                  <span className="deal-analysis-seat">{contract.declarer}</span>
                )}
                <span className={points(score(contract))}>{signed(score(contract))}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <TrickTable analysis={analysis} />
    </div>
  );
}

/** Level and denomination, drawn the way a bid is drawn everywhere else. */
function Contract({ level, color }: { level: number | null; color: BidColor }) {
  return (
    <span className="bid-call">
      <span className="bid-level">{level ?? ''}</span>
      <SuitMark suit={color} />
    </span>
  );
}

/** The three questions the same twenty cells answer, in the order the button walks through them. */
type TableView = 'contract' | 'taken' | 'down';

const views: readonly TableView[] = ['contract', 'taken', 'down'];

const viewHeadings: Record<TableView, string> = {
  contract: 'Kontrakt',
  taken: 'Ile lew biorą',
  down: 'Bez ilu wpadliby',
};

/** The button is named for where it goes, not for where it is. */
const viewButtons: Record<TableView, string> = {
  contract: 'Lewy',
  taken: 'Wpadki',
  down: 'Kontrakt',
};

/** Which of the three numbers on a cell each view is showing. The server worked all three out; this only picks one. */
const readings: Record<TableView, (cell: DoubleDummyCell) => number | string | null | undefined> = {
  contract: (cell) => cell.level,
  taken: (cell) => cell.tricks,
  down: (cell) => cell.down,
};

/** The cheapest contract there is. Below it a seat has nothing to bid, and nothing in this grid to say. */
const smallestContract = 7;

/**
 * The whole double dummy truth about the deal: what each seat takes in each denomination.
 */
/*
 * Twenty cells, and everything else in the panel is read off them - par, each pair's best, what the auction cost.
 *
 * Three questions are asked of them: the contract those tricks are worth bidding, the tricks themselves, and - for the
 * side that did not buy the auction - how far down taking the contract away would have left it. The first is the one to
 * open on, because it answers "what should have been bid" without any arithmetic in the reader's head.
 */
function TrickTable({ analysis }: { analysis: DoubleDummyResponse }) {
  const [view, setView] = useState<TableView>('contract');
  const cells = new Map(analysis.table.map((cell) => [`${cell.declarer}:${cell.color}`, cell]));

  const advance = () => setView((current) => views[(views.indexOf(current) + 1) % views.length]);

  return (
    <section className="deal-analysis-section">
      <div className="deal-analysis-heading">
        <h4>{viewHeadings[view]}</h4>
        <button type="button" className="deal-analysis-toggle" onClick={advance}>
          {viewButtons[view]}
        </button>
      </div>

      <table className="deal-analysis-table">
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Ręka</span>
            </th>
            {denominations.map((denomination) => (
              <th key={denomination} scope="col">
                <SuitMark suit={denomination} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {playerPositions.map((position) => (
            <tr key={position}>
              <th scope="row">{position}</th>
              {denominations.map((denomination) => {
                const cell = cells.get(`${position}:${denomination}`);
                const value = cell === undefined ? null : toNumber(readings[view](cell));
                return (
                  <td key={denomination} className={notable(view, cell, value) ? 'makes' : undefined}>
                    {value ?? '—'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/**
 * Whether a cell is one to pick out of the grid, which is not the same question in each view.
 *
 * Two of the views are being scanned for contracts that can be bought, so seven tricks is the line. The third is being
 * scanned for the opposite: a contract the defenders could have taken away without going down at all, which is a good
 * deal more striking than the number of tricks behind it.
 */
function notable(view: TableView, cell: DoubleDummyCell | undefined, value: number | null): boolean {
  if (cell === undefined || value === null) {
    return false;
  }

  return view === 'down' ? value === 0 : (toNumber(cell.tricks) ?? 0) >= smallestContract;
}

/*
 * The generated `Pair` carries a null of its own - the enum picked it up from the places the server does declare it
 * nullable - so even a pair the server guarantees has to be read through a guard.
 */
function pairName(pair: Pair): string {
  return pair === null || pair === undefined ? '' : pairLabels[pair];
}

/**
 * Why the number is what it is: what the pair could have done, and where any part of the loss was paid at the table.
 *
 * The undertricks are worth naming separately. The rest of a difference is the contract that was never played, and that
 * half is obvious with the best contract on screen a line below - this half is not, and a figure like six hundred reads
 * very differently once two hundred of it is accounted for.
 */
function explain(difference: DoubleDummyDifference, played: DoubleDummyPlayed | null | undefined): string {
  const reason = difference.reason === null || difference.reason === undefined ? '' : missLabels[difference.reason];
  const undertricks = penalty(played, difference.pair);

  if (undertricks === null) {
    return reason;
  }

  return reason === '' ? `${signed(undertricks)} za wpadkę` : `${reason}, w tym ${signed(undertricks)} za wpadkę`;
}

/** The part of a loss a pair paid for directly, by going down in the contract it bought. */
function penalty(played: DoubleDummyPlayed | null | undefined, pair: Pair): number | null {
  if (played === null || played === undefined || played.pair !== pair) {
    return null;
  }

  const score = toNumber(played.score);
  return (toNumber(played.underTricks) ?? 0) > 0 && score !== null ? score : null;
}

function score(contract: DoubleDummyBestContract): number {
  return toNumber(contract.score) ?? 0;
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function points(value: number): string {
  return value < 0 ? 'deal-analysis-score negative' : 'deal-analysis-score';
}
