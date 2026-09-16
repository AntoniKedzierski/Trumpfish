import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker, useNavigate } from 'react-router-dom';
import { getBiddingSystem, listBiddingSystems } from '@/api/biddingSystems';
import type { BiddingSystem, BiddingSystemSummary, DuoSettings, PracticeHint } from '@/api/models';
import { ToolBar } from '@/components/ToolBar';
import { Auction, BidCard, ComboBox, ConfirmDialog, Hand } from '@/ui';
import { BidWarning } from '@/features/practice/components/BidWarning';
import { BiddingBox, type BoxBid } from '@/features/practice/components/BiddingBox';
import { openingChoices } from '@/features/practice/openings';
import { DealResultCard } from '@/features/simulation/components/DealResultCard';
import { vulnerabilityLabels } from '@/features/simulation/vulnerability';
import { useRealtime } from '@/realtime/useRealtime';
import { BackIcon, CardsIcon, CloseIcon, UsersIcon } from '@/components/icons';
import { HelpTip } from '@/components/HelpTip';
import '@/components/SetupCard.css';
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
  const navigate = useNavigate();
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
            <button type="button" className="primary" onClick={clearEnded}>
              <BackIcon />
              <span>Wróć do ustawień</span>
            </button>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="practice duo">
      <Header />

      {/*
        * One bar for the whole table: who you are sitting with on the left, what you can do about this deal and this
        * session on the right. Only a live table has anything to put on it.
        */}
      <ToolBar
        status={
          table === null ? null : (
            <>
              <span className="duo-partner">
                z {table.partner.name}
                {table.partner.connected ? null : <span className="duo-dropped"> (rozłączony)</span>}
              </span>
              {table.you.isHost || !table.finished ? null : <Waiting>Czekam, aż partner rozda następne rozdanie</Waiting>}
            </>
          )
        }
      >
        {table === null ? null : (
          <>
            {/* Only the host deals: the table is one table, and two people dealing it would be two different deals. */}
            {!table.you.isHost ? null : (
              <button type="button" className="primary" onClick={() => run(nextDeal)} disabled={busy}>
                <CardsIcon />
                <span>Następne</span>
              </button>
            )}
            <button type="button" onClick={() => leave(() => void navigate('/'))} disabled={busy}>
              <CloseIcon />
              <span>Zakończ</span>
            </button>
          </>
        )}
      </ToolBar>

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
              <ComboBox
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
                <HelpTip>Karty pod to otwarcie dostaje jedno z was — za każdym rozdaniem losowo.</HelpTip>
              </span>
              <ComboBox
                value={openingNodeId}
                options={[
                  { value: '', label: 'Wszystkie - karty bez warunków' },
                  ...openings.map((choice) => ({
                    value: choice.nodeId,
                    label: `${choice.label} · ${choice.meaning}`,
                    // The string is what the option is announced and titled by; this is what it looks like.
                    labelNode: (
                      <>
                        <BidCard bid={{ type: choice.type, color: choice.color, value: choice.level }} />
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
                Partner
                <HelpTip>Widać tu tylko znajomych, którzy są online i nie siedzą już przy innym stole.</HelpTip>
              </span>
              <ComboBox
                value={partnerId}
                options={available.map((friend) => ({ value: friend.userId, label: friend.displayName ?? friend.username }))}
                onChange={setPartnerId}
                placeholder={friends === null ? 'Wczytuję znajomych…' : 'Nikt ze znajomych nie jest teraz dostępny'}
                disabled={available.length === 0}
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
                <HelpTip>Nazwane ziarno powtarza te same rozdania — razem z tym, kto w którym otwiera.</HelpTip>
              </span>
              <input type="text" value={seed} placeholder="Losowe…" onChange={(event) => setSeed(event.target.value)} />
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
              <HelpTip>Każdy dostaje informację tylko o swoich odzywkach, których jego ręka nie potwierdza.</HelpTip>
            </div>

            <button type="button" className="primary" onClick={invite} disabled={busy || connection !== 'connected' || systemId === '' || partnerId === ''}>
              <UsersIcon />
              <span>Zaproś do stołu</span>
            </button>

            {connection === 'connected' ? null : <small className="duo-waiting">Łączę z serwerem…</small>}
            {/* The decline arrives as a remark, so it takes the place of the waiting line rather than sitting next to it. */}
            {awaiting === null || notice !== null ? null : <small className="duo-waiting">Zaproszenie wysłane do {awaiting}. Czekam na odpowiedź…</small>}
            {notice === null ? null : <small className="duo-waiting">{notice}</small>}
            {invitations.length === 0 ? null : <small className="duo-waiting">Masz zaproszenie — odpowiedz na nie na pasku u góry.</small>}
          </section>
        ) : (
          <div className="stack">
            {/* While bidding only the mistake just made is worth reading; the review sums up every one of them. */}
            <BidWarning warnings={table.finished ? table.warnings : table.warnings.slice(-1)} />

            {table.finished && table.result !== null && table.result !== undefined ? (
              <DealResultCard key={table.dealNumber} deal={table.result} />
            ) : (
              <>
                <section className="panel hand-panel">
                  <div className="panel-head">
                    {/* Named the way the simulator names a deal, down to the wording: it is the same deal, seen earlier. */}
                    <h2 className="deal-title">Rozdanie {table.dealNumber}</h2>
                    <span className="deal-meta">Rozdaje {table.dealer} · po partii {vulnerabilityLabels[table.vulnerability]}</span>
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

                  <Hand hand={table.hand} />

                  {hint === null || hint.at !== table.bidding.length ? null : (
                    <p className="hint">
                      {hint.answer.bid === null || hint.answer.bid === undefined ? (
                        'Silnik nie znajduje tu dla ciebie odzywki w systemie.'
                      ) : (
                        <>
                          Silnik zalicytowałby <strong><BidCard bid={hint.answer.bid} /></strong>
                          {hint.answer.meaning === null || hint.answer.meaning === undefined ? null : ` — ${hint.answer.meaning}`}
                        </>
                      )}
                    </p>
                  )}
                </section>

                <section className="panel box-panel">
                  <h2>Twoja odzywka</h2>
                  <BiddingBox legal={table.legal} disabled={!table.yourTurn || busy} onBid={(chosen: BoxBid) => run(() => bid(chosen.type, chosen.color, chosen.value))} />
                  {table.yourTurn ? null : <Waiting>Czekam na {table.partner.connected ? 'ruch przy stole' : 'powrót partnera'}</Waiting>}
                </section>

                <section className="panel auction-panel">
                  <h2>Licytacja</h2>
                  <Auction
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
        <ConfirmDialog
          title="Opuścić stół?"
          question="Wyjście z tego widoku kończy sesję — także dla partnera."
          cancelLabel="Zostań"
          confirmLabel="Zakończ i wyjdź"
          confirmIcon={CloseIcon}
          danger
          onConfirm={() => leave(() => blocker.proceed?.())}
          onClose={() => blocker.reset?.()}
        />
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

function describe(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
