import { useCallback, useEffect, useMemo, useState } from 'react';
import { getBiddingSystem, listBiddingSystems } from '@/api/biddingSystems';
import { simulateBidding } from '@/api/simulation';
import type { BiddingSystem, BiddingSystemSummary, SimulationResponse } from '@/api/models';
import { CardsIcon } from '@/components/icons';
import { ToolBar, toolbarKeepLonger } from '@/components/ToolBar';
import { conventionChoices } from '@/features/practice/conventions';
import { defenceChoices, openingChoices } from '@/features/practice/openings';
import { ConfigMenu } from '../components/ConfigMenu';
import { DealResultCard } from '../components/DealResultCard';
import { FilterMenu } from '../components/FilterMenu';
import { SortMenu } from '../components/SortMenu';
import { generateDeals } from '../deals';
import type { DealFilters } from '../filters';
import { emptyFilters, filterDeals } from '../filters';
import { sortDeals } from '../sorting';
import type { SortDirection, SortKey } from '../sorting';
import './SimulationPage.css';

export function SimulationPage() {
  const [systems, setSystems] = useState<BiddingSystemSummary[]>([]);
  const [systemId, setSystemId] = useState('');
  const [dealCount, setDealCount] = useState(500);
  const [seed, setSeed] = useState('');
  const [result, setResult] = useState<SimulationResponse | null>(null);
  /**
   * The system the result was bid with, which is not necessarily the one chosen now - the configuration can change after a run.
   * The opening and convention filters are built out of its tree, since those are the bids the result is made of.
   */
  const [resultSystemId, setResultSystemId] = useState('');
  const [resultTree, setResultTree] = useState<BiddingSystem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('index');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  // One committed value for the whole sheet: the draft the user is editing lives inside `FilterMenu` until it is applied.
  const [filters, setFilters] = useState<DealFilters>(emptyFilters);

  const sortedDeals = useMemo(
    () => (result === null ? [] : sortDeals(filterDeals(result.deals, filters), sortKey, sortDirection)),
    [filters, result, sortDirection, sortKey],
  );

  /*
   * The cards are built once per result and handed back unchanged until the result, the filters or the order change.
   *
   * Every keystroke in the configuration panel is a render of this page, and each of those was rebuilding five hundred
   * finished deals - hands, auction and analysis - to arrive at exactly the same markup. That is why typing the seed
   * crawled once there was a run behind it, and why it was perfectly quick before the first one. React skips a subtree
   * whose element it has already seen, so keeping the elements is what keeps the field responsive.
   */
  const cards = useMemo(
    () => sortedDeals.map((deal) => <DealResultCard key={deal.index} deal={deal} analyseWithSystemId={systemId} />),
    [sortedDeals, systemId],
  );

  const openings = useMemo(() => openingChoices(resultTree), [resultTree]);
  const defences = useMemo(() => defenceChoices(resultTree), [resultTree]);
  const conventions = useMemo(() => conventionChoices(resultTree), [resultTree]);

  useEffect(() => {
    let cancelled = false;
    listBiddingSystems().then(
      (loaded) => {
        if (!cancelled) {
          setSystems(loaded);
        }
      },
      (reason) => { if (!cancelled) { setError(describe(reason)); } },
    );

    return () => { cancelled = true; };
  }, []);

  // Fetched whole only once a run has been made with it: until then there are no results to filter.
  useEffect(() => {
    if (resultSystemId === '') {
      return;
    }

    let cancelled = false;
    getBiddingSystem(resultSystemId).then(
      (loaded) => { if (!cancelled) { setResultTree(loaded); } },
      (reason) => { if (!cancelled) { setError(describe(reason)); setResultTree(null); } },
    );

    return () => { cancelled = true; };
  }, [resultSystemId]);

  const run = useCallback(async () => {
    if (systemId === '') {
      setError('Wybierz system licytacyjny.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      // Deals are generated here and shipped to the API, so the server only runs the engine. The seed (when given) makes the batch reproducible.
      const trimmedSeed = seed.trim();
      setResult(await simulateBidding({ systemId, deals: generateDeals(dealCount, trimmedSeed), seed: trimmedSeed === '' ? null : trimmedSeed }));

      // Another system means other bids, so an opening, a defence or a convention picked from the previous one no longer names anything.
      if (systemId !== resultSystemId) {
        setResultSystemId(systemId);
        setResultTree(null);
        setFilters((current) => ({ ...current, opening: '', defence: '', convention: '' }));
      }
    } catch (reason) {
      setError(describe(reason));
    } finally {
      setBusy(false);
    }
  }, [dealCount, resultSystemId, seed, systemId]);

  return (
    <div className="simulation">
      <h1 className="sr-only">Symulacja licytacji AI</h1>

      <ToolBar
        status={
          <>
            {busy ? <span className="status">Symulacja…</span> : null}
            {error === null ? null : <span className="status error">{error}</span>}
            {result === null ? null : <span>{sortedDeals.length} z {result.dealCount} rozdań</span>}
          </>
        }
      >
        <ConfigMenu
          systems={systems}
          systemId={systemId}
          onSystemId={setSystemId}
          dealCount={dealCount}
          onDealCount={setDealCount}
          seed={seed}
          onSeed={setSeed}
          disabled={busy}
        />

        {/* Komenda, po którą się tu przyszło: oddaje swoje słowo jako ostatnia. */}
        <button type="button" className={`primary ${toolbarKeepLonger}`} onClick={() => void run()} disabled={busy || systemId === ''}>
          <CardsIcon />
          <span>Symuluj</span>
        </button>

        {result === null ? null : (
          <>
            {/* Everything that narrows or reorders the results lives behind these two, so the bar stays one row of controls. */}
            {/* Keyed by the system, so the sheet's draft starts over from the filters the switch above just cleared. */}
            <FilterMenu key={resultSystemId} value={filters} onChange={setFilters} openings={openings} defences={defences} conventions={conventions} />

            <SortMenu sortKey={sortKey} direction={sortDirection} onSortKey={setSortKey} onDirection={setSortDirection} />
          </>
        )}
      </ToolBar>

      <section className="results">
        {result === null ? (
          <p className="placeholder">Wygeneruj rozdania i uruchom symulację, aby zobaczyć ręce, punkty i przebieg licytacji.</p>
        ) : (
          cards
        )}
      </section>
    </div>
  );
}

function describe(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
