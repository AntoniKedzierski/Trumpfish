import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listBiddingSystems } from '@/api/biddingSystems';
import { simulateBidding } from '@/api/simulation';
import type { BiddingSystemSummary, SimulationResponse } from '@/api/models';
import { Select } from '@/components/Select';
import { DealResultCard } from '../components/DealResultCard';
import { generateDeals } from '../deals';
import { filterDeals, gameFilterLabels, sideFilterLabels } from '../filters';
import type { GameFilterKey, SideFilterKey } from '../filters';
import { sortDeals, sortDirectionLabels, sortKeyLabels } from '../sorting';
import type { SortDirection, SortKey } from '../sorting';
import './SimulationPage.css';

const maxDeals = 500;

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
  const [sideFilter, setSideFilter] = useState<SideFilterKey>('any');
  const [gameFilter, setGameFilter] = useState<GameFilterKey>('any');
  const [bidSearch, setBidSearch] = useState('');

  const sortedDeals = useMemo(
    () => (result === null ? [] : sortDeals(filterDeals(result.deals, sideFilter, gameFilter, bidSearch), sortKey, sortDirection)),
    [bidSearch, gameFilter, result, sideFilter, sortDirection, sortKey],
  );

  useEffect(() => {
    let cancelled = false;
    listBiddingSystems().then(
      (loaded) => {
        if (!cancelled) {
          setSystems(loaded);
          setSystemId((current) => (current === '' ? (loaded[0]?.id ?? '') : current));
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
      <header className="page-header">
        <Link to="/" className="back-link">
          ← Narzędzia
        </Link>
        <h1>Symulacja licytacji AI</h1>
        {busy ? <span className="status">Symulacja…</span> : null}
        {error === null ? null : <span className="status error">{error}</span>}
      </header>

      <section className="controls">
        <label className="inline">
          <span>System</span>
          <Select
            value={systemId}
            options={systems.map((system) => ({ value: system.id, label: system.name }))}
            onChange={setSystemId}
            placeholder="Brak zapisanych systemów"
            disabled={busy || systems.length === 0}
          />
        </label>

        <label className="inline">
          <span>Liczba rozdań</span>
          <input
            type="number"
            min={1}
            max={maxDeals}
            value={dealCount}
            disabled={busy}
            onChange={(event) => setDealCount(clamp(Number(event.target.value)))}
          />
        </label>

        <label className="inline">
          <span>Ziarno</span>
          <input
            type="text"
            value={seed}
            placeholder="puste = losowe"
            disabled={busy}
            onChange={(event) => setSeed(event.target.value)}
          />
        </label>

        <button type="button" className="primary" onClick={() => void run()} disabled={busy || systemId === ''}>
          Symuluj
        </button>

        {result === null ? null : (
          <>
            <label className="inline">
              <span>Sortuj</span>
              <Select
                value={sortKey}
                options={(Object.keys(sortKeyLabels) as SortKey[]).map((key) => ({ value: key, label: sortKeyLabels[key] }))}
                onChange={setSortKey}
                disabled={busy}
              />
            </label>

            <label className="inline">
              <span>Kierunek</span>
              <Select
                value={sortDirection}
                options={(Object.keys(sortDirectionLabels) as SortDirection[]).map((key) => ({ value: key, label: sortDirectionLabels[key] }))}
                onChange={setSortDirection}
                disabled={busy}
              />
            </label>

            <label className="inline">
              <span>Licytacja</span>
              <Select
                value={sideFilter}
                options={(Object.keys(sideFilterLabels) as SideFilterKey[]).map((key) => ({ value: key, label: sideFilterLabels[key] }))}
                onChange={setSideFilter}
                disabled={busy}
              />
            </label>

            <label className="inline">
              <span>Kontrakt</span>
              <Select
                value={gameFilter}
                options={(Object.keys(gameFilterLabels) as GameFilterKey[]).map((key) => ({ value: key, label: gameFilterLabels[key] }))}
                onChange={setGameFilter}
                disabled={busy}
              />
            </label>

            <label className="inline">
              <span>Odzywka</span>
              <input
                type="search"
                className="bid-search"
                value={bidSearch}
                placeholder="np. 1NT, 2h, x"
                disabled={busy}
                onChange={(event) => setBidSearch(event.target.value)}
              />
            </label>

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

function clamp(value: number): number {
  if (Number.isNaN(value)) {
    return 1;
  }

  return Math.min(maxDeals, Math.max(1, Math.trunc(value)));
}

function describe(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
