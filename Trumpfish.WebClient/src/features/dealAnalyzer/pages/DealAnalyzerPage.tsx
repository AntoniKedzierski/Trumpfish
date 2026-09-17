import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { listBiddingSystems } from '@/api/biddingSystems';
import { getSavedDeal } from '@/api/savedDeals';
import { startReplay, submitReplayBid } from '@/api/replay';
import { simulateBidding } from '@/api/simulation';
import type { BiddingSystemSummary, PlayerPosition, ReplayState, SavedDeal, SimulationDealResult } from '@/api/models';
import { playerPositions, positionLabels } from '@/api/models';
import { CardsIcon, PlayIcon, RepeatIcon, SettingsIcon } from '@/components/icons';
import { ToolBar } from '@/components/ToolBar';
import { Auction, Button, ComboBoxField, ContractChip, DealCard, Hand, Popup } from '@/ui';
import { BiddingBox } from '@/features/practice/components/BiddingBox';
import type { BoxBid } from '@/features/practice/components/BiddingBox';
import { DealAnalysis } from '@/features/simulation/components/DealAnalysis';
import { ContractSummary } from '@/features/simulation/components/DealResultCard';
import { makesGame } from '@/features/simulation/sorting';
import { vulnerabilityLabels } from '@/features/simulation/vulnerability';
import '@/components/SetupCard.css';
import '@/features/practice/pages/PracticePage.css';
import { DealPicker } from '../components/DealPicker';
import { analyzerRoute } from '../route';
import type { AnalyzerMode } from '../route';
import './DealAnalyzerPage.css';

/** Powtórzona licytacja: czyja jest i czym się skończyła. Trzymana jest jedna - ostatnia. */
interface Redone {
  title: string;
  result: SimulationDealResult;
}

/**
 * Wszystko, co dotyczy jednego otwartego rozdania.
 */
/*
 * Trzymane razem i podpisane numerem rozdania, bo razem traci ważność: wczytanie innego rozdania unieważnia licytację,
 * powtórkę i to, czy karty są zakryte. Stan z innego numeru jest po prostu nie pokazywany, zamiast być gaszony polami.
 */
interface Session {
  dealId: string;
  deal: SavedDeal;
  /** Trwająca albo skończona licytacja od nowa. Null, dopóki nikt jej nie zaczął. */
  replay: ReplayState | null;
  redone: Redone | null;
  /** Czy pozostałe trzy ręce są jeszcze zakryte. Odkrywa je koniec licytacji i nic poza nim. */
  hidden: boolean;
}

/**
 * Zapisane rozdanie z bliska: wszystkie karty, licytacja, która wtedy padła, i analiza DDS na żądanie.
 */
/*
 * Rozdanie stoi w adresie, a tryb obok niego - dzięki temu replay zaczyna się od zakrytych kart także wtedy, gdy ktoś
 * wejdzie tu z zakładki, a "wczytaj inne" to zwykłe przejście, nie osobny stan widoku.
 *
 * Żadna powtórka nie jest nigdzie zapisywana: zapisane rozdanie jest zapisem tego, co się stało, a powtórka jest
 * ćwiczeniem licytującego i żyje tylko tak długo, jak otwarty widok.
 */
export function DealAnalyzerPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const [search] = useSearchParams();
  const navigate = useNavigate();

  const mode: AnalyzerMode = search.get('mode') === 'replay' ? 'replay' : 'analysis';

  const [systems, setSystems] = useState<BiddingSystemSummary[]>([]);
  const [systemId, setSystemId] = useState('');
  const [seat, setSeat] = useState<PlayerPosition>('South');

  const [session, setSession] = useState<Session | null>(null);
  const [failure, setFailure] = useState<{ dealId?: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Stan i błąd należą do rozdania z adresu; cudzy jest tym, co zostało po poprzednim, i nie ma czego mówić o tym.
  const current = session !== null && session.dealId === dealId ? session : null;
  const error = failure !== null && failure.dealId === dealId ? failure.text : null;
  const loading = dealId !== undefined && current === null && error === null;

  const fail = (reason: unknown) => setFailure({ dealId, text: reason instanceof Error ? reason.message : String(reason) });

  /** Zmiana w otwartym rozdaniu. Nie ma jak dotknąć cudzego: zmieniane jest to, co właśnie jest na ekranie. */
  const update = (change: Partial<Omit<Session, 'dealId' | 'deal'>>) => {
    setSession((held) => (held === null || held.dealId !== dealId ? held : { ...held, ...change }));
  };

  useEffect(() => {
    let cancelled = false;
    listBiddingSystems().then(
      (found) => {
        if (!cancelled) {
          setSystems(found);
          setSystemId((chosen) => (chosen === '' ? (found[0]?.id ?? '') : chosen));
        }
      },
      (reason: unknown) => { if (!cancelled) { fail(reason); } },
    );

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rozdanie z adresu. Brak numeru znaczy, że nic jeszcze nie wybrano - wtedy widok jest listą do wyboru.
  useEffect(() => {
    if (dealId === undefined) {
      return;
    }

    let cancelled = false;
    getSavedDeal(dealId).then(
      (deal) => {
        if (!cancelled) {
          setFailure(null);
          setSession({ dealId, deal, replay: null, redone: null, hidden: mode === 'replay' });
        }
      },
      (reason: unknown) => { if (!cancelled) { fail(reason); } },
    );

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId, mode]);

  /** Sadza gracza na wskazanym miejscu i zakrywa pozostałe ręce, dopóki licytacja nie dobiegnie końca. */
  const begin = async (position: PlayerPosition) => {
    if (current === null || systemId === '') {
      return;
    }

    setBusy(true);
    setFailure(null);
    setSeat(position);
    update({ replay: null, redone: null, hidden: true });

    try {
      const state = await startReplay({
        systemId,
        dealer: current.deal.deal.dealer,
        vulnerability: current.deal.summary.vulnerability,
        player: position,
        hands: current.deal.deal.hands.map(({ position: at, cards }) => ({ position: at, cards })),
      });

      update({ replay: state });
    }
    catch (reason) {
      fail(reason);
      // Licytacja, która się nie zaczęła, nie ma prawa trzymać kart zakrytych - poza trybem, który i tak zaczyna zakryty.
      update({ hidden: mode === 'replay' });
    }
    finally {
      setBusy(false);
    }
  };

  const bid = async (chosen: BoxBid) => {
    if (current?.replay == null) {
      return;
    }

    setBusy(true);
    setFailure(null);

    try {
      const next = await submitReplayBid({ state: current.replay.state, type: chosen.type, color: chosen.color, value: chosen.value });

      update({
        replay: next,
        hidden: !next.finished,
        redone: next.finished && next.result != null
          ? { title: `Twoja licytacja z ${positionLabels[next.player]}`, result: next.result }
          : current.redone,
      });
    }
    catch (reason) {
      fail(reason);
    }
    finally {
      setBusy(false);
    }
  };

  /** Te same karty oddane czterem botom. Oryginalna licytacja zostaje - to ona jest zapisem rozdania. */
  const repeat = async () => {
    if (current === null || systemId === '') {
      return;
    }

    setBusy(true);
    setFailure(null);

    try {
      const answer = await simulateBidding({
        systemId,
        deals: [{
          dealer: current.deal.deal.dealer,
          hands: current.deal.deal.hands.map(({ position, cards }) => ({ position, cards })),
        }],
      });

      const result = answer.deals[0];
      if (result === undefined) {
        setFailure({ dealId, text: 'Silnik nie odesłał licytacji tego rozdania.' });
        return;
      }

      update({ redone: { title: `Licytacja botów · ${answer.systemName}`, result } });
    }
    catch (reason) {
      fail(reason);
    }
    finally {
      setBusy(false);
    }
  };

  const replay = current?.replay ?? null;
  const bidding = current !== null && current.hidden && replay !== null && !replay.finished;

  return (
    <div className="deal-analyzer">
      <h1 className="sr-only">Analiza rozdania</h1>

      {current === null ? null : (
        <ToolBar
          status={
            <>
              {busy ? <span className="status">Chwileczkę…</span> : null}
              {error === null ? null : <span className="status error">{error}</span>}
            </>
          }
        >
          <Button icon={CardsIcon} onClick={() => void navigate(analyzerRoute)}>Wczytaj rozdanie</Button>

          <Popup label="Ustawienia" icon={SettingsIcon}>
            <div className="ui-panel-section">
              <ComboBoxField
                label="System licytacyjny"
                hint="Tym systemem licytują boty - i w powtórce, i przy stole. Ten sam system daje tę samą licytację, bo silnik nie zgaduje."
                value={systemId}
                options={systems.map((system) => ({ value: system.id, label: system.name }))}
                onChange={setSystemId}
                placeholder="Brak zapisanych systemów"
                disabled={systems.length === 0}
              />
            </div>
          </Popup>

          <Button
            icon={RepeatIcon}
            disabled={busy || bidding || systemId === ''}
            title={bidding ? 'Najpierw dokończ swoją licytację.' : 'Te same karty, licytowane od nowa przez cztery boty'}
            onClick={() => void repeat()}
          >
            Powtórz licytację
          </Button>

          <Popup label="Rozegraj licytację" icon={PlayIcon} disabled={busy || bidding || systemId === ''}>
            {(close) => (
              <>
                <div className="ui-panel-section">
                  <ComboBoxField
                    label="Twoje miejsce"
                    hint="Do końca licytacji widzisz tylko karty z tego miejsca. Pozostałe trzy licytują boty."
                    value={seat}
                    options={playerPositions.map((position) => ({ value: position, label: position }))}
                    onChange={setSeat}
                  />
                </div>

                <div className="ui-panel-section">
                  <Button size="small" variant="primary" icon={PlayIcon} onClick={() => { close(); void begin(seat); }}>
                    Zacznij
                  </Button>
                </div>
              </>
            )}
          </Popup>
        </ToolBar>
      )}

      <main className="analyzer-main">
        {dealId === undefined ? <DealPicker /> : null}

        {loading ? <p className="dealing">Wczytuję rozdanie…</p> : null}
        {current === null && error !== null ? <p className="dealing">{error}</p> : null}

        {current === null ? null : (
          <div className="stack">
            {bidding && replay !== null ? (
              <>
                <section className="panel hand-panel">
                  <div className="panel-head">
                    <h2 className="deal-title">{current.deal.summary.name}</h2>
                    <span className="deal-meta">
                      Rozdaje {current.deal.deal.dealer} · po partii {vulnerabilityLabels[current.deal.summary.vulnerability]}
                    </span>
                  </div>

                  <Hand hand={replay.playerHand} />
                </section>

                <section className="panel box-panel">
                  <h2>Twoja odzywka</h2>
                  <BiddingBox legal={replay.legal} disabled={!replay.playerToBid || busy} onBid={(chosen) => void bid(chosen)} />
                </section>

                <section className="panel auction-panel">
                  <h2>Licytacja</h2>
                  {/* W ciemno nic nie mówi, co odzywka znaczyła ani czy była z systemu - to byłaby odpowiedź na ćwiczenie. */}
                  <Auction
                    bidding={replay.bidding}
                    dealer={replay.dealer}
                    explain={false}
                    flagOffSystem={false}
                    awaiting={replay.playerToBid ? replay.player : null}
                  />
                  {replay.error == null ? null : <p className="live-error">{replay.error}</p>}
                </section>
              </>
            ) : current.hidden ? (
              <section className="setup-card">
                <h2>{current.deal.summary.name}</h2>
                <p className="deal-meta">
                  Rozdaje {current.deal.deal.dealer} · po partii {vulnerabilityLabels[current.deal.summary.vulnerability]}
                </p>
                <p>
                  Zobaczysz tylko karty z miejsca {positionLabels[seat]} i wylicytujesz to rozdanie od nowa przeciwko trzem
                  botom. Reszta rąk odkryje się po zakończeniu licytacji. Miejsce i system zmienisz na pasku.
                </p>

                <Button variant="primary" icon={PlayIcon} disabled={busy || systemId === ''} onClick={() => void begin(seat)}>
                  Zacznij licytację
                </Button>
              </section>
            ) : (
              <>
                <DealCard
                  title={current.deal.summary.name}
                  meta={`Rozdaje ${current.deal.deal.dealer} · po partii ${vulnerabilityLabels[current.deal.summary.vulnerability]}`}
                  contract={current.deal.deal.contract}
                  declarer={current.deal.deal.contract.declarer}
                  game={makesGame(current.deal.deal.contract)}
                  error={current.deal.deal.error}
                  hands={current.deal.deal.hands}
                  bidding={current.deal.deal.bidding}
                  dealer={current.deal.deal.dealer}
                  footnote={
                    <>
                      <ContractSummary contract={current.deal.deal.contract} />
                      <DealAnalysis deal={current.deal.deal} vulnerability={current.deal.summary.vulnerability} />
                    </>
                  }
                />

                {/* Zapisana licytacja zostaje na karcie, powtórka staje pod nią - czyta się je jedna po drugiej. */}
                {current.redone === null ? null : <RedoneAuction redone={current.redone} />}

                {current.deal.summary.comment == null || current.deal.summary.comment === '' ? null : (
                  <section className="panel">
                    <h2>Komentarz</h2>
                    <p className="analyzer-comment">{current.deal.summary.comment}</p>
                  </section>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

/** Druga licytacja tego samego rozdania: czyja jest i do czego doszła. */
function RedoneAuction({ redone }: { redone: Redone }) {
  return (
    <section className="panel analyzer-redone">
      <div className="panel-head">
        <h2 className="deal-title">{redone.title}</h2>
        <ContractChip contract={redone.result.contract} declarer={redone.result.contract.declarer} />
      </div>

      <Auction bidding={redone.result.bidding} dealer={redone.result.dealer} />

      {redone.result.error == null ? null : <p className="live-error">{redone.result.error}</p>}
    </section>
  );
}
