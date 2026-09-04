import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getBiddingSystem, listBiddingSystems } from '@/api/biddingSystems';
import { getPracticeHint, startPracticeDeal, submitPracticeBid } from '@/api/practice';
import type { BiddingSystem, BiddingSystemSummary, PracticeHint, PracticeRole, PracticeState } from '@/api/models';
import { Select } from '@/components/Select';
import { DealResultCard } from '@/features/simulation/components/DealResultCard';
import { BidLabel, BiddingTable, HandView } from '@/features/simulation/components/DealViews';
import { positionLabels } from '@/features/simulation/deals';
import { BiddingBox, type BoxBid } from '../components/BiddingBox';
import { BidWarning } from '../components/BidWarning';
import { exportDeals, type SavedDeal } from '../analysis';
import { openingChoices } from '../openings';
import './PracticePage.css';

/**
 * Configuring an exercise and playing it are two different jobs, so they are two different screens: the settings are answered
 * once and then get out of the way, leaving the table to the deal.
 */
type Phase = 'setup' | 'playing' | 'ended';

/** When the player gets to see what a bid promised: while the auction runs, or only once the deal is over. */
type MeaningMode = 'immediate' | 'summary';

const meaningLabels: Record<MeaningMode, string> = {
  immediate: 'Od razu w licytacji',
  summary: 'Dopiero w podsumowaniu',
};

const roleLabels: Record<PracticeRole, string> = {
  Opener: 'Otwierający',
  Responder: 'Odpowiadający',
};

export function PracticePage() {
  const [systems, setSystems] = useState<BiddingSystemSummary[]>([]);
  const [systemId, setSystemId] = useState('');
  const [tree, setTree] = useState<BiddingSystem | null>(null);
  const [seed, setSeed] = useState('');
  const [openingNodeId, setOpeningNodeId] = useState('');
  const [role, setRole] = useState<PracticeRole>('Opener');
  const [meanings, setMeanings] = useState<MeaningMode>('summary');
  const [checkBids, setCheckBids] = useState(false);

  const [phase, setPhase] = useState<Phase>('setup');
  const [dealNumber, setDealNumber] = useState(0);
  const [table, setTable] = useState<PracticeState | null>(null);
  const [saved, setSaved] = useState<SavedDeal[]>([]);
  const [savedCurrent, setSavedCurrent] = useState(false);
  const [hint, setHint] = useState<PracticeHint | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const openings = useMemo(() => openingChoices(tree), [tree]);
  const opening = openings.find((choice) => choice.nodeId === openingNodeId) ?? null;
  const systemName = systems.find((system) => system.id === systemId)?.name ?? '';

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

  // The openings to practise come out of the system's own tree, so it is fetched whole as soon as one is picked.
  useEffect(() => {
    if (systemId === '') {
      return;
    }

    let cancelled = false;
    getBiddingSystem(systemId).then(
      (loaded) => { if (!cancelled) { setTree(loaded); } },
      (reason) => { if (!cancelled) { setError(describe(reason)); setTree(null); } },
    );

    return () => { cancelled = true; };
  }, [systemId]);

  const run = useCallback(async (operation: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await operation();
    } catch (reason) {
      setError(describe(reason));
    } finally {
      setBusy(false);
    }
  }, []);

  /** Deals number `index` of the session, which is also what decides who deals: N, E, S and W in turn. */
  const deal = (index: number) => run(async () => {
    setNotice(null);
    setSavedCurrent(false);
    setHint(null);
    setTable(await startPracticeDeal({
      systemId,
      dealIndex: index,
      seed: seed.trim() === '' ? null : seed.trim(),
      openingNodeId: openingNodeId === '' ? null : openingNodeId,
      role,
      checkBids,
    }));
    setDealNumber(index + 1);
  });

  const start = () => {
    if (systemId === '') {
      setError('Wybierz system licytacyjny.');
      return;
    }

    setPhase('playing');
    void deal(0);
  };

  const bid = (chosen: BoxBid) => run(async () => {
    if (table === null) {
      return;
    }

    // The hint answered the turn that has just been played, so it goes with it.
    setHint(null);
    setTable(await submitPracticeBid({ state: table.state, type: chosen.type, color: chosen.color, value: chosen.value }));
  });

  const askHint = () => run(async () => {
    if (table !== null) {
      setHint(await getPracticeHint(table.state));
    }
  });

  const save = () => {
    const result = table?.result;
    if (result === null || result === undefined) {
      return;
    }

    setSaved((current) => [...current, {
      savedAt: new Date().toISOString(),
      systemName,
      seed: seed.trim() === '' ? null : seed.trim(),
      opening: opening === null ? null : `${opening.label} - ${opening.meaning}`,
      role,
      deal: result,
    }]);

    setSavedCurrent(true);
    setNotice('Rozdanie zapisane do analizy.');
  };

  const finished = table !== null && table.finished;

  return (
    <div className="practice">
      <header className="page-header">
        <Link to="/" className="back-link">
          ← Narzędzia
        </Link>
        <h1>Ćwiczenie licytacji</h1>

        {busy ? <span className="status">Licytują boty…</span> : null}
        {notice === null || busy ? null : <span className="status">{notice}</span>}
        {error === null ? null : <span className="status error">{error}</span>}

        {phase === 'playing' ? (
          <div className="header-actions">
            <button type="button" onClick={() => setPhase('setup')}>Ustawienia</button>
            <button type="button" onClick={() => setPhase('ended')}>Zakończ</button>
          </div>
        ) : null}
      </header>

      <main className="practice-main">
        {phase === 'setup' ? (
          <section className="setup-card">
            <h2>Co ćwiczymy?</h2>

            <label>
              <span>System licytacyjny</span>
              <Select
                value={systemId}
                options={systems.map((system) => ({ value: system.id, label: system.name }))}
                /* Another system means another tree, so the opening being practised cannot survive the switch. */
                onChange={(id) => { setSystemId(id); setOpeningNodeId(''); }}
                placeholder="Brak zapisanych systemów"
                disabled={systems.length === 0}
              />
            </label>

            <label>
              <span>Ćwiczone otwarcie</span>
              <Select
                value={openingNodeId}
                options={[
                  { value: '', label: 'Wszystkie - karty bez warunków' },
                  ...openings.map((choice) => ({ value: choice.nodeId, label: `${choice.label} · ${choice.meaning}` })),
                ]}
                onChange={setOpeningNodeId}
                disabled={openings.length === 0}
              />
              <small>Dostaniesz karty, którymi da się to otworzyć. Puste - rozdania bez żadnych warunków.</small>
            </label>

            <label>
              <span>Siadasz jako</span>
              <Select
                value={role}
                options={(Object.keys(roleLabels) as PracticeRole[]).map((key) => ({ value: key, label: roleLabels[key] }))}
                onChange={setRole}
                disabled={openingNodeId === ''}
              />
              <small>Przy odpowiadaniu warunki dostaje partner, a ty dowolne karty.</small>
            </label>

            <label>
              <span>Znaczenia odzywek</span>
              <Select
                value={meanings}
                options={(Object.keys(meaningLabels) as MeaningMode[]).map((key) => ({ value: key, label: meaningLabels[key] }))}
                onChange={setMeanings}
              />
            </label>

            <label>
              <span>Ziarno</span>
              <input type="text" value={seed} placeholder="puste = losowe" onChange={(event) => setSeed(event.target.value)} />
              <small>Nazwane ziarno powtarza te same rozdania, rozdanie po rozdaniu.</small>
            </label>

            <div className="field">
              <label className="toggle">
                <input type="checkbox" checked={checkBids} onChange={(event) => setCheckBids(event.target.checked)} />
                <span>Sprawdzaj moje odzywki</span>
              </label>
              <small>Gdy zalicytujesz coś, czego twoja ręka nie potwierdza, dostaniesz informację co obiecałeś i co mówi system.</small>
            </div>

            <button type="button" className="primary" onClick={start} disabled={busy || systemId === ''}>
              {table === null ? 'Zaczynamy' : 'Zacznij od nowa'}
            </button>

            {table === null ? null : (
              <button type="button" onClick={() => setPhase('playing')}>Wróć do rozdania</button>
            )}

            {saved.length === 0 ? null : (
              <p className="setup-saved">
                Do analizy odłożono {saved.length} {dealWord(saved.length)}.{' '}
                <button type="button" className="link" onClick={() => exportDeals(saved)}>Eksportuj .json</button>
              </p>
            )}
          </section>
        ) : null}

        {phase === 'ended' ? (
          <section className="setup-card">
            <h2>Koniec ćwiczenia</h2>
            <p>
              {saved.length === 0
                ? 'Nie zapisano żadnego rozdania do analizy.'
                : `Do analizy odłożono ${saved.length} ${dealWord(saved.length)}. Plik zawiera pełną licytację i karty wszystkich graczy.`}
            </p>

            <button type="button" className="primary" onClick={() => exportDeals(saved)} disabled={saved.length === 0}>
              Eksportuj .json
            </button>
            <button type="button" onClick={() => setSaved([])} disabled={saved.length === 0}>
              Wyczyść zapisane
            </button>
            <button type="button" onClick={() => setPhase(table === null ? 'setup' : 'playing')}>
              {table === null ? 'Wróć do ustawień' : 'Wróć do rozdania'}
            </button>
          </section>
        ) : null}

        {phase === 'playing' && table === null ? <p className="dealing">Rozdaję…</p> : null}

        {phase === 'playing' && table !== null ? (
          <div className="stack">
            <div className="deal-bar">
              <span className="deal-number">Rozdanie {dealNumber}</span>
              <span className="deal-context">
                Rozdaje {positionLabels[table.dealer]}
                {opening === null ? null : <> · {opening.label} jako {roleLabels[role].toLowerCase()}</>}
              </span>

              <div className="deal-actions">
                <button type="button" onClick={save} disabled={!finished || savedCurrent}>
                  {savedCurrent ? 'Zapisane' : 'Zapisz do analizy'}
                </button>
                <button type="button" className="primary" onClick={() => void deal(dealNumber)} disabled={busy || !finished}>
                  Następne rozdanie
                </button>
              </div>
            </div>

            {/* While bidding only the mistake just made is worth reading; the review sums up every one of them. */}
            <BidWarning warnings={finished ? table.warnings : table.warnings.slice(-1)} />

            {finished && table.result !== null && table.result !== undefined ? (
              <DealResultCard key={dealNumber} deal={table.result} />
            ) : (
              <>
                <section className="panel">
                  <div className="panel-head">
                    <h2>Twoja ręka</h2>
                    <button
                      type="button"
                      className="hint-button"
                      onClick={() => void askHint()}
                      disabled={!table.playerToBid || busy}
                      title="Co zalicytowałby silnik?"
                      aria-label="Podpowiedź"
                    >
                      ?
                    </button>
                  </div>

                  <HandView hand={table.playerHand} />

                  {hint === null ? null : (
                    <p className="hint">
                      {hint.bid === null || hint.bid === undefined ? (
                        'Silnik nie znajduje tu dla ciebie odzywki w systemie.'
                      ) : (
                        <>
                          Silnik zalicytowałby <strong><BidLabel bid={hint.bid} /></strong>
                          {hint.meaning === null || hint.meaning === undefined ? null : ` — ${hint.meaning}`}
                        </>
                      )}
                    </p>
                  )}
                </section>

                <section className="panel">
                  <h2>Twoja odzywka</h2>
                  <BiddingBox legal={table.legal} disabled={!table.playerToBid || busy} onBid={(chosen) => void bid(chosen)} />
                </section>

                <section className="panel">
                  <h2>Licytacja</h2>
                  <BiddingTable
                    key={dealNumber}
                    bidding={table.bidding}
                    dealer={table.dealer}
                    explain={meanings === 'immediate'}
                    /* During the auction nothing says which bids came out of the system - that would answer the exercise. */
                    flagOffSystem={false}
                    awaiting={table.playerToBid ? table.player : null}
                  />
                  {table.error === null || table.error === undefined ? null : <p className="live-error">{table.error}</p>}
                </section>
              </>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}

function dealWord(count: number): string {
  if (count === 1) {
    return 'rozdanie';
  }

  // Polish counts in threes: 2-4 take one form, everything else another, and the teens go with the majority.
  const tens = count % 100;
  const units = count % 10;
  return units >= 2 && units <= 4 && (tens < 12 || tens > 14) ? 'rozdania' : 'rozdań';
}

function describe(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
