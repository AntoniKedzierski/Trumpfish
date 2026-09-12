import { useCallback, useEffect, useMemo, useState } from 'react';
import { listBiddingSystems } from '@/api/biddingSystems';
import { simulateBidding } from '@/api/simulation';
import type { BiddingSystemSummary, SimulationResponse } from '@/api/models';
import { CardsIcon } from '@/components/icons';
import { PageStatus } from '@/components/PageStatus';
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
  const [dealCount, setDealCount] = useState(10);
  const [seed, setSeed] = useState('');
  const [result, setResult] = useState<SimulationResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('index');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  // One committed value for the whole sheet: the draft the user is editing lives inside `FilterMenu` until it is applied.
  const [filters, setFilters] = useState<DealFilters>(emptyFilters);

  const sortedDeals = useMemo(
    () => (result === null ? [] : sortDeals(filterDeals(result.deals, filters.side, filters.games, filters.bid), sortKey, sortDirection)),
    [filters, result, sortDirection, sortKey],
  );

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
    } catch (reason) {
      setError(describe(reason));
    } finally {
      setBusy(false);
    }
  }, [dealCount, seed, systemId]);

  return (
    <div className="simulation">
      <h1 className="sr-only">Symulacja licytacji AI</h1>

      <PageStatus>
        {busy ? <span className="status">Symulacja…</span> : null}
        {error === null ? null : <span className="status error">{error}</span>}
      </PageStatus>

      <section className="controls">
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

        <button type="button" className="primary" onClick={() => void run()} disabled={busy || systemId === ''}>
          <CardsIcon />
          <span>Symuluj</span>
        </button>

        {result === null ? null : (
          <>
            {/* Everything that narrows or reorders the results lives behind these two, so the bar stays one row of controls. */}
            <FilterMenu value={filters} onChange={setFilters} />

            <SortMenu sortKey={sortKey} direction={sortDirection} onSortKey={setSortKey} onDirection={setSortDirection} />

            <span className="summary">
              {sortedDeals.length} z {result.dealCount} rozdań, błędów: {result.failedCount}
            </span>
          </>
        )}
      </section>

      <section className="results">
        {result === null ? (
          <p className="placeholder">Wygeneruj rozdania i uruchom symulację, aby zobaczyć ręce, punkty i przebieg licytacji.</p>
        ) : (
          sortedDeals.map((deal) => <DealResultCard key={deal.index} deal={deal} />)
        )}
      </section>
    </div>
  );
}

function describe(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
