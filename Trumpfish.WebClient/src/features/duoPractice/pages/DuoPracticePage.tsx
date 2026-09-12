import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { getBiddingSystem, listBiddingSystems } from '@/api/biddingSystems';
import { toNumber } from '@/api/models';
import type { BiddingSystem, BiddingSystemSummary, DuoSettings, PracticeHint } from '@/api/models';
import { Select } from '@/components/Select';
import { exportDeals, type SavedDeal } from '@/features/practice/analysis';
import { BidWarning } from '@/features/practice/components/BidWarning';
import { BiddingBox, type BoxBid } from '@/features/practice/components/BiddingBox';
import { openingChoices } from '@/features/practice/openings';
import { DealResultCard } from '@/features/simulation/components/DealResultCard';
import { BidLabel, BiddingTable, HandView } from '@/features/simulation/components/DealViews';
import { positionLabels } from '@/features/simulation/deals';
import { useRealtime } from '@/realtime/useRealtime';
import '@/features/practice/pages/PracticePage.css';
import './DuoPracticePage.css';

/** When the players get to see what a bid promised: while the auction runs, or only once the deal is over. */
const meaningLabels = {
  immediate: 'Od razu w licytacji',
  summary: 'Dopiero w podsumowaniu',
} as const;

type MeaningMode = keyof typeof meaningLabels;

/**
 * Two people practising one bidding system against two bots. Everything about the table lives on the server and arrives over
 * the hub, so this page only ever renders what it was last sent and sends back what its player pressed.
 */
export function DuoPracticePage() {
  const { friends, table, ended, clearEnded, invitations, notice, connection, inviteToTable, bid, requestHint, nextDeal, endTable } = useRealtime();

  const [systems, setSystems] = useState<BiddingSystemSummary[]>([]);
  const [systemId, setSystemId] = useState('');
  const [tree, setTree] = useState<BiddingSystem | null>(null);
  const [openingNodeId, setOpeningNodeId] = useState('');
  const [seed, setSeed] = useState('');
  const [meanings, setMeanings] = useState<MeaningMode>('summary');
  const [allowHints, setAllowHints] = useState(true);
  const [checkBids, setCheckBids] = useState(false);
  const [partnerId, setPartnerId] = useState('');

  const [saved, setSaved] = useState<SavedDeal[]>([]);
  const [savedDeal, setSavedDeal] = useState<number | null>(null);
  // Carried with the turn it answered, so a hint stops being shown the moment the auction moves on rather than being cleared
  // from an effect after the fact.
  const [hint, setHint] = useState<{ at: number; answer: PracticeHint } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Who an invitation is out to, so the host sees that he is waiting rather than that nothing happened. */
  const [awaiting, setAwaiting] = useState<string | null>(null);

  const openings = useMemo(() => openingChoices(tree), [tree]);
  const available = (friends?.friends ?? []).filter((friend) => friend.presence === 'Online');

  // Leaving ends the session for both of them, so both ways out have to be held up: the router for a navigation inside the
  // application, and beforeunload for a reload or a closed tab, which the router never sees.
  const leaving = useRef(false);
  const blocker = useBlocker(() => table !== null && !leaving.current);

  useEffect(() => {
    if (table === null) {
      return;
    }

    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };

    // Once the page really is going, the session is ended outright rather than being left to the grace period: a reload is a
    // deliberate departure, and the partner should not sit waiting for somebody who chose to leave. A beacon is used because
    // it is the only request a browser reliably delivers while tearing a page down.
    const leaveForGood = () => { navigator.sendBeacon('/api/duo/leave'); };

    window.addEventListener('beforeunload', warn);
    window.addEventListener('pagehide', leaveForGood);

    return () => {
      window.removeEventListener('beforeunload', warn);
      window.removeEventListener('pagehide', leaveForGood);
    };
  }, [table]);

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

  // The openings to practise come out of the system own tree, so it is fetched whole as soon as one is picked.
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

  const run = useCallback((operation: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    operation().catch((reason: unknown) => setError(describe(reason))).finally(() => setBusy(false));
  }, []);

  const invite = () => {
    if (systemId === '' || partnerId === '') {
      setError('Wybierz system i znajomego.');
      return;
    }

    const settings: DuoSettings = {
      systemId,
      openingNodeId: openingNodeId === '' ? null : openingNodeId,
      seed: seed.trim() === '' ? null : seed.trim(),
      allowHints,
      immediateMeanings: meanings === 'immediate',
      checkBids,
    };

    const partner = available.find((friend) => friend.userId === partnerId);
    setAwaiting(null);
    run(async () => {
      await inviteToTable(partnerId, settings);
      setAwaiting(partner?.displayName ?? partner?.username ?? 'partner');
    });
  };

  const save = () => {
    if (table?.result === null || table?.result === undefined) {
      return;
    }

    setSaved((current) => [...current, {
      savedAt: new Date().toISOString(),
      systemName: table.systemName,
      seed: table.settings.seed ?? null,
      opening: table.openingLabel ?? null,
      partner: table.partner.name,
      deal: table.result!,
    }]);

    setSavedDeal(toNumber(table.dealNumber));
  };

  /** Lets the router through once, so leaving after the session was ended on purpose does not ask again. */
  const leave = (proceed: () => void) => {
    leaving.current = true;
    endTable().catch(() => undefined).finally(proceed);
  };

  if (ended !== null) {
    return (
      <div className="practice duo">
        <Header />
        <main className="practice-main">
          <section className="setup-card">
            <h2>Koniec sesji</h2>
            <p>{ended.message}</p>
            <p>
              {saved.length === 0
                ? 'Nie zapisano żadnego rozdania do analizy.'
                : `Do analizy odłożono ${saved.length} ${dealWord(saved.length)}. Plik zawiera pełną licytację i karty wszystkich graczy.`}
            </p>

            <button type="button" className="primary" onClick={() => exportDeals(saved)} disabled={saved.length === 0}>Eksportuj .json</button>
            <button type="button" onClick={() => { setSaved([]); clearEnded(); }}>Wróć do ustawień</button>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="practice duo">
      <Header />

      <main className="practice-main">
        {error === null ? null : <p className="duo-error">{error}</p>}
        {notice === null || table === null ? null : <p className="duo-notice">{notice}</p>}

        {table === null ? (
          <section className="setup-card">
            <h2>Ćwiczenie we dwoje</h2>
            <p className="duo-lead">
              Siadacie jako para — ty i znajomy przeciwko dwóm botom. Otwierającego losuje się w każdym rozdaniu, więc obaj
              ćwiczycie obie strony sekwencji. Ustawienia poniżej obowiązują oboje.
            </p>

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
              <small>Karty pod to otwarcie dostaje jedno z was — za każdym rozdaniem losowo.</small>
            </label>

            <label>
              <span>Partner</span>
              <Select
                value={partnerId}
                options={available.map((friend) => ({ value: friend.userId, label: friend.displayName ?? friend.username }))}
                onChange={setPartnerId}
                placeholder={friends === null ? 'Wczytuję znajomych…' : 'Nikt ze znajomych nie jest teraz dostępny'}
                disabled={available.length === 0}
              />
              <small>Widać tu tylko znajomych, którzy są online i nie siedzą już przy innym stole.</small>
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
              <small>Nazwane ziarno powtarza te same rozdania — razem z tym, kto w którym otwiera.</small>
            </label>

            <div className="field">
              <label className="toggle">
                <input type="checkbox" checked={allowHints} onChange={(event) => setAllowHints(event.target.checked)} />
                <span>Pozwól pytać, co zalicytowałby silnik</span>
              </label>
            </div>

            <div className="field">
              <label className="toggle">
                <input type="checkbox" checked={checkBids} onChange={(event) => setCheckBids(event.target.checked)} />
                <span>Sprawdzaj odzywki</span>
              </label>
              <small>Każdy dostaje informację tylko o swoich odzywkach, których jego ręka nie potwierdza.</small>
            </div>

            <button type="button" className="primary" onClick={invite} disabled={busy || connection !== 'connected' || systemId === '' || partnerId === ''}>
              Zaproś do stołu
            </button>

            {connection === 'connected' ? null : <small className="duo-waiting">Łączę z serwerem…</small>}
            {/* The decline arrives as a remark, so it takes the place of the waiting line rather than sitting next to it. */}
            {awaiting === null || notice !== null ? null : <small className="duo-waiting">Zaproszenie wysłane do {awaiting}. Czekam na odpowiedź…</small>}
            {notice === null ? null : <small className="duo-waiting">{notice}</small>}
            {invitations.length === 0 ? null : <small className="duo-waiting">Masz zaproszenie — odpowiedz na nie na pasku u góry.</small>}
          </section>
        ) : (
          <div className="stack">
            <div className="deal-bar">
              <span className="deal-number">Rozdanie {table.dealNumber}</span>
              <span className="deal-context">
                Rozdaje {positionLabels[table.dealer]} · z {table.partner.name}
                {table.partner.connected ? null : <span className="duo-dropped"> (rozłączony)</span>}
                {table.openingLabel === null || table.openingLabel === undefined ? null : <> · {table.openingLabel}</>}
              </span>

              {/* Sits on its own, before the buttons, rather than standing in for one of them: it is a status, not an action. */}
              {table.you.isHost || !table.finished ? null : <Waiting>Czekam, aż partner rozda następne rozdanie</Waiting>}

              <div className="deal-actions">
                <button type="button" onClick={save} disabled={!table.finished || savedDeal === toNumber(table.dealNumber)}>
                  {savedDeal === toNumber(table.dealNumber) ? 'Zapisane' : 'Zapisz do analizy'}
                </button>
                {!table.you.isHost ? null : (
                  <button type="button" className="primary" onClick={() => run(nextDeal)} disabled={busy || !table.finished}>Następne rozdanie</button>
                )}
                <button type="button" onClick={() => run(endTable)} disabled={busy}>Zakończ</button>
              </div>
            </div>

            {/* While bidding only the mistake just made is worth reading; the review sums up every one of them. */}
            <BidWarning warnings={table.finished ? table.warnings : table.warnings.slice(-1)} />

            {table.finished && table.result !== null && table.result !== undefined ? (
              <DealResultCard key={table.dealNumber} deal={table.result} />
            ) : (
              <>
                <section className="panel">
                  <div className="panel-head">
                    <h2>Twoja ręka ({positionLabels[table.you.position]})</h2>
                    {!table.settings.allowHints ? null : (
                      <button
                        type="button"
                        className="hint-button"
                        onClick={() => run(async () => setHint({ at: table.bidding.length, answer: await requestHint() }))}
                        disabled={!table.yourTurn || busy}
                        title="Co zalicytowałby silnik?"
                        aria-label="Podpowiedź"
                      >
                        ?
                      </button>
                    )}
                  </div>

                  <HandView hand={table.hand} />

                  {hint === null || hint.at !== table.bidding.length ? null : (
                    <p className="hint">
                      {hint.answer.bid === null || hint.answer.bid === undefined ? (
                        'Silnik nie znajduje tu dla ciebie odzywki w systemie.'
                      ) : (
                        <>
                          Silnik zalicytowałby <strong><BidLabel bid={hint.answer.bid} /></strong>
                          {hint.answer.meaning === null || hint.answer.meaning === undefined ? null : ` — ${hint.answer.meaning}`}
                        </>
                      )}
                    </p>
                  )}
                </section>

                <section className="panel">
                  <h2>Twoja odzywka</h2>
                  <BiddingBox legal={table.legal} disabled={!table.yourTurn || busy} onBid={(chosen: BoxBid) => run(() => bid(chosen.type, chosen.color, chosen.value))} />
                  {table.yourTurn ? null : <Waiting>Czekam na {table.partner.connected ? 'ruch przy stole' : 'powrót partnera'}</Waiting>}
                </section>

                <section className="panel">
                  <h2>Licytacja</h2>
                  <BiddingTable
                    key={table.dealNumber}
                    bidding={table.bidding}
                    dealer={table.dealer}
                    explain={table.settings.immediateMeanings}
                    /* During the auction nothing says which bids came out of the system - that would answer the exercise. */
                    flagOffSystem={false}
                    awaiting={table.yourTurn ? table.you.position : table.partner.position}
                  />
                  {table.error === null || table.error === undefined ? null : <p className="live-error">{table.error}</p>}
                </section>
              </>
            )}
          </div>
        )}
      </main>

      {blocker.state !== 'blocked' ? null : (
        <div className="leave-backdrop" role="presentation" onClick={() => blocker.reset?.()}>
          <div className="leave-dialog" role="alertdialog" aria-modal="true" aria-labelledby="leave-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="leave-title">Opuścić stół?</h2>
            <p>Wyjście z tego widoku kończy sesję — także dla partnera. Zapisane rozdania możesz wyeksportować dopiero po zakończeniu.</p>
            <div className="leave-actions">
              <button type="button" autoFocus onClick={() => blocker.reset?.()}>Zostań</button>
              <button type="button" className="danger" onClick={() => leave(() => blocker.proceed?.())}>Zakończ i wyjdź</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * That the table is waiting on somebody else, said the same way everywhere: a turning ring and a slow pulse, so it reads as
 * something in progress rather than as a sentence that happens to be sitting there.
 */
function Waiting({ children }: { children: React.ReactNode }) {
  return (
    <span className="duo-pending" role="status">
      <span className="duo-spinner" aria-hidden="true" />
      <span>{children}…</span>
    </span>
  );
}

/* The top bar names the tool, so what is left of the header is the heading a screen reader still needs to find. */
function Header() {
  return <h1 className="sr-only">Ćwiczenie we dwoje</h1>;
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
