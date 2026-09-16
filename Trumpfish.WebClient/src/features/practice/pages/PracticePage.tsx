import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBiddingSystem, listBiddingSystems } from '@/api/biddingSystems';
import { getPracticeHint, startPracticeDeal, submitPracticeBid } from '@/api/practice';
import type { BiddingSystem, BiddingSystemSummary, PracticeHint, PracticeRole, PracticeState } from '@/api/models';
import { ToolBar } from '@/components/ToolBar';
import { Select } from '@/components/Select';
import { DealResultCard } from '@/features/simulation/components/DealResultCard';
import { BidLabel, BiddingTable, HandView } from '@/features/simulation/components/DealViews';
import { vulnerabilityLabels } from '@/features/simulation/vulnerability';
import { BiddingBox, type BoxBid } from '../components/BiddingBox';
import { BidWarning } from '../components/BidWarning';
import { openingChoices } from '../openings';
import { CardsIcon, CloseIcon, PlayIcon, SettingsIcon } from '@/components/icons';
import { HelpTip } from '@/components/HelpTip';
import { BidMark } from '@/components/suits';
import '@/components/SetupCard.css';
import './PracticePage.css';

/**
 * Configuring an exercise and playing it are two different jobs, so they are two different screens: the settings are answered
 * once and then get out of the way, leaving the table to the deal.
 */
type Phase = 'setup' | 'playing';

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
  const navigate = useNavigate();
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
  const [hint, setHint] = useState<PracticeHint | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openings = useMemo(() => openingChoices(tree), [tree]);

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

  const finished = table !== null && table.finished;

  return (
    <div className="practice">
      <h1 className="sr-only">Ćwiczenie licytacji</h1>

      {/*
        * One bar for everything pressed between bids: what to do with this deal, then what to do with the session. The
        * commands start at the left edge, the way they do on every other bar in the application.
        */}
      <ToolBar
        status={
          <>
            {busy ? <span className="status">Licytują boty…</span> : null}
            {error === null ? null : <span className="status error">{error}</span>}
          </>
        }
      >
        {phase !== 'playing' || table === null ? null : (
          <>
            {/* A deal is dealt on demand, finished or not: a hand nobody wants to bid out is a reason to move on, not to sit. */}
            <button type="button" className="primary" onClick={() => void deal(dealNumber)} disabled={busy}>
              <CardsIcon />
              <span>Następne</span>
            </button>
            <button type="button" onClick={() => setPhase('setup')}>
              <SettingsIcon />
              <span>Ustawienia</span>
            </button>
            <button type="button" onClick={() => void navigate('/')}>
              <CloseIcon />
              <span>Zakończ</span>
            </button>
          </>
        )}
      </ToolBar>

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
              <span className="field-name">
                Ćwiczone otwarcie
                <HelpTip>Dostaniesz karty, którymi da się to otworzyć. Puste - rozdania bez żadnych warunków.</HelpTip>
              </span>
              <Select
                value={openingNodeId}
                options={[
                  { value: '', label: 'Wszystkie - karty bez warunków' },
                  ...openings.map((choice) => ({
                    value: choice.nodeId,
                    label: `${choice.label} · ${choice.meaning}`,
                    // The string is what the option is announced and titled by; this is what it looks like.
                    labelNode: (
                      <>
                        <BidMark type={choice.type} color={choice.color} level={choice.level} />
                        {` · ${choice.meaning}`}
                      </>
                    ),
                  })),
                ]}
                onChange={setOpeningNodeId}
                disabled={openings.length === 0}
              />
            </label>

            <label>
              <span className="field-name">
                Siadasz jako
                <HelpTip>Przy odpowiadaniu warunki dostaje partner, a ty dowolne karty.</HelpTip>
              </span>
              <Select
                value={role}
                options={(Object.keys(roleLabels) as PracticeRole[]).map((key) => ({ value: key, label: roleLabels[key] }))}
                onChange={setRole}
                disabled={openingNodeId === ''}
              />
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
              <span className="field-name">
                Ziarno
                <HelpTip>Nazwane ziarno powtarza te same rozdania, rozdanie po rozdaniu.</HelpTip>
              </span>
              <input type="text" value={seed} placeholder="Losowe…" onChange={(event) => setSeed(event.target.value)} />
            </label>

            <div className="field">
              <label className="toggle">
                <input type="checkbox" checked={checkBids} onChange={(event) => setCheckBids(event.target.checked)} />
                <span>Sprawdzaj moje odzywki</span>
              </label>
              <HelpTip>Gdy zalicytujesz coś, czego twoja ręka nie potwierdza, dostaniesz informację co obiecałeś i co mówi system.</HelpTip>
            </div>

            <button type="button" className="primary" onClick={start} disabled={busy || systemId === ''}>
              <PlayIcon />
              <span>{table === null ? 'Zaczynamy' : 'Zacznij od nowa'}</span>
            </button>

            {table === null ? null : (
              <button type="button" onClick={() => setPhase('playing')}>Wróć do rozdania</button>
            )}
          </section>
        ) : null}

        {phase === 'playing' && table === null ? <p className="dealing">Rozdaję…</p> : null}

        {phase === 'playing' && table !== null ? (
          <div className="stack">
            {/* While bidding only the mistake just made is worth reading; the review sums up every one of them. */}
            <BidWarning warnings={finished ? table.warnings : table.warnings.slice(-1)} />

            {finished && table.result !== null && table.result !== undefined ? (
              <DealResultCard key={dealNumber} deal={table.result} />
            ) : (
              <>
                <section className="panel hand-panel">
                  <div className="panel-head">
                    {/* Named the way the simulator names a deal, down to the wording: it is the same deal, seen earlier. */}
                    <h2 className="deal-title">Rozdanie {dealNumber}</h2>
                    <span className="deal-meta">Rozdaje {table.dealer} · po partii {vulnerabilityLabels[table.vulnerability]}</span>
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

                <section className="panel box-panel">
                  <h2>Twoja odzywka</h2>
                  <BiddingBox legal={table.legal} disabled={!table.playerToBid || busy} onBid={(chosen) => void bid(chosen)} />
                </section>

                <section className="panel auction-panel">
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

function describe(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
