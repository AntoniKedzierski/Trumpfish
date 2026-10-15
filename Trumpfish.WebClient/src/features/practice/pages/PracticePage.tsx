import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBiddingSystem, listBiddingSystems } from '@/api/biddingSystems';
import { getPracticeHint, startPracticeDeal, submitPracticeBid } from '@/api/practice';
import type { BiddingSystem, BiddingSystemSummary, PracticeHint, PracticeRole, PracticeState } from '@/api/models';
import { ToolBar } from '@/components/ToolBar';
import { Auction, BidCard, ComboBox, Hand } from '@/ui';
import { DealResultCard } from '@/features/simulation/components/DealResultCard';
import { vulnerabilityLabels } from '@/features/simulation/vulnerability';
import { BiddingBox, type BoxBid } from '../components/BiddingBox';
import { BidWarning } from '../components/BidWarning';
import { defenceChoices, openingChoices } from '../openings';
import { conventionChoices } from '../conventions';
import { ConventionPicker } from '../components/ConventionPicker';
import { OpeningPicker } from '../components/OpeningPicker';
import { DefencePicker } from '../components/DefencePicker';
import { CardsIcon, CloseIcon, PlayIcon, SettingsIcon } from '@/components/icons';
import { HelpTip } from '@/components/HelpTip';
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

/** With a convention chosen the seat is about the convention, not the opening: who bids it, and who has to answer it. */
const conventionRoleLabels: Record<PracticeRole, string> = {
  Opener: 'Zgłaszasz konwencję',
  Responder: 'Odpowiadasz na konwencję',
};

/** With a defence chosen, and no convention, the seat is about the defence: who makes it, and who has to answer it. */
const defenceRoleLabels: Record<PracticeRole, string> = {
  Opener: 'Bronisz się',
  Responder: 'Odpowiadasz na obronę partnera',
};

export function PracticePage() {
  const navigate = useNavigate();
  const [systems, setSystems] = useState<BiddingSystemSummary[]>([]);
  const [systemId, setSystemId] = useState('');
  const [tree, setTree] = useState<BiddingSystem | null>(null);
  const [seed, setSeed] = useState('');
  const [openingNodeId, setOpeningNodeId] = useState('');
  /** Node id of the defence practised, empty for none. An auction has an opening of ours or a defence, never both. */
  const [defenceNodeId, setDefenceNodeId] = useState('');
  /** Matching key of the convention practised, empty for none. */
  const [convention, setConvention] = useState('');
  const [role, setRole] = useState<PracticeRole>('Opener');
  const [meanings, setMeanings] = useState<MeaningMode>('summary');
  const [checkBids, setCheckBids] = useState(false);

  const [phase, setPhase] = useState<Phase>('setup');
  const [dealNumber, setDealNumber] = useState(0);
  const [table, setTable] = useState<PracticeState | null>(null);
  const [hint, setHint] = useState<PracticeHint | null>(null);

  const [busy, setBusy] = useState(false);
  /** A convention deal is searched for rather than dealt, which takes noticeably longer - the status says so. */
  const [searching, setSearching] = useState(false);
  /** What the deal on the table was found for. Kept apart from the setting, which may change before the next deal. */
  const [practised, setPractised] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openings = useMemo(() => openingChoices(tree), [tree]);
  const conventions = useMemo(() => conventionChoices(tree), [tree]);
  const conventionLabel = conventions.find((choice) => choice.key === convention)?.label ?? null;
  const defences = useMemo(() => defenceChoices(tree), [tree]);
  const defenceLabel = defences.find((choice) => choice.nodeId === defenceNodeId)?.label ?? null;

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
      setSearching(false);
    }
  }, []);

  /** Deals number `index` of the session, which is also what decides who deals: N, E, S and W in turn. */
  const deal = (index: number) => run(async () => {
    setHint(null);
    setSearching(conventionLabel !== null || defenceLabel !== null);
    setTable(await startPracticeDeal({
      systemId,
      dealIndex: index,
      seed: seed.trim() === '' ? null : seed.trim(),
      openingNodeId: openingNodeId === '' ? null : openingNodeId,
      role,
      checkBids,
      convention: conventionLabel,
      defenceNodeId: defenceNodeId === '' ? null : defenceNodeId,
    }));
    setPractised(practisedText(defenceLabel, conventionLabel));
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
            {busy ? <span className="status">{searching ? 'Szukam rozdania…' : 'Licytują boty…'}</span> : null}
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
              <ComboBox
                value={systemId}
                options={systems.map((system) => ({ value: system.id, label: system.name }))}
                /* Another system means another tree, so nothing being practised survives the switch. */
                onChange={(id) => { setSystemId(id); setOpeningNodeId(''); setDefenceNodeId(''); setConvention(''); }}
                placeholder="Brak zapisanych systemów"
                disabled={systems.length === 0}
              />
            </label>

            <label>
              <span className="field-name">
                Ćwiczone otwarcie
                <HelpTip>Dostaniesz karty, którymi da się to otworzyć. Puste - rozdania bez żadnych warunków.</HelpTip>
              </span>
              {/* An auction has an opening of ours or a defence against theirs, never both - choosing one lets the other go. */}
              <OpeningPicker value={openingNodeId} openings={openings} onChange={(id) => { setOpeningNodeId(id); if (id !== '') { setDefenceNodeId(''); } }} />
            </label>

            <label>
              <span className="field-name">
                Ćwiczona obrona
                <HelpTip>
                  Przeciwnicy otwierają, a boty licytują całe rozdania, aż ktoś z waszej pary obroni się tą odzywką - to rozdanie
                  dostajesz. Wybranie obrony zdejmuje ćwiczone otwarcie.
                </HelpTip>
              </span>
              <DefencePicker value={defenceNodeId} defences={defences} onChange={(id) => { setDefenceNodeId(id); if (id !== '') { setOpeningNodeId(''); } }} />
            </label>

            <label>
              <span className="field-name">
                Ćwiczona konwencja
                <HelpTip>
                  Boty licytują całe rozdania, aż któryś użyje tej konwencji - to rozdanie dostajesz. Z wybranym otwarciem albo
                  obroną konwencja musi paść po nich. Rzadkie konwencje szuka się dłużej.
                </HelpTip>
              </span>
              <ConventionPicker value={convention} conventions={conventions} onChange={setConvention} />
            </label>

            <label>
              <span className="field-name">
                Siadasz jako
                <HelpTip>
                  {conventionLabel !== null
                    ? 'Zgłaszasz konwencję albo odpowiadasz partnerowi, który jej użyje.'
                    : defenceLabel !== null
                      ? 'Bronisz się sam albo odpowiadasz partnerowi, który się obroni.'
                      : 'Przy odpowiadaniu warunki dostaje partner, a ty dowolne karty.'}
                </HelpTip>
              </span>
              <ComboBox
                value={role}
                options={(Object.keys(roleLabels) as PracticeRole[]).map((key) => ({
                  value: key,
                  label: (conventionLabel !== null ? conventionRoleLabels : defenceLabel !== null ? defenceRoleLabels : roleLabels)[key],
                }))}
                onChange={setRole}
                disabled={openingNodeId === '' && conventionLabel === null && defenceLabel === null}
              />
            </label>

            <label>
              <span>Znaczenia odzywek</span>
              <ComboBox
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

        {/* Only the first deal of a session can fail with nothing on the table - and then there is no bar to leave by either. */}
        {phase === 'playing' && table === null ? (
          busy ? (
            <p className="dealing">{searching ? 'Szukam rozdania, w którym padnie to, co ćwiczysz…' : 'Rozdaję…'}</p>
          ) : (
            <div className="dealing">
              <p>{error ?? 'Nie udało się rozdać.'}</p>
              <button type="button" onClick={() => setPhase('setup')}>
                <SettingsIcon />
                <span>Ustawienia</span>
              </button>
            </div>
          )
        ) : null}

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
                    <span className="deal-meta">Rozdaje {table.dealer} · po partii {vulnerabilityLabels[table.vulnerability]}{practised === null ? null : ` · ${practised}`}</span>
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

                  <Hand hand={table.playerHand} />

                  {hint === null ? null : (
                    <p className="hint">
                      {hint.bid === null || hint.bid === undefined ? (
                        'Silnik nie znajduje tu dla ciebie odzywki w systemie.'
                      ) : (
                        <>
                          Silnik zalicytowałby <strong><BidCard bid={hint.bid} /></strong>
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
                  <Auction
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

/** What a deal was found for, as the line above the hand names it. Null when it was simply dealt. */
function practisedText(defence: string | null, convention: string | null): string | null {
  const parts = [defence === null ? null : `obrona: ${defence}`, convention === null ? null : `konwencja: ${convention}`];
  const named = parts.filter((part) => part !== null);
  return named.length === 0 ? null : named.join(' · ');
}

function describe(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
