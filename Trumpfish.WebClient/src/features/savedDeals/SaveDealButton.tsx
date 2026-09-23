import { useState } from 'react';
import type { SimulationDealResult, Vulnerability } from '@/api/models';
import { saveDeal } from '@/api/savedDeals';
import { SaveIcon, SearchIcon } from '@/components/icons';
import { Button } from '@/ui';
import { analyzerLink } from '@/features/dealAnalyzer/route';
import { DealDetailsDialog } from './DealDetailsDialog';
import type { DealDetails } from './DealDetailsDialog';
import './savedDeals.css';

interface SaveDealButtonProps {
  deal: SimulationDealResult;
  vulnerability: Vulnerability;
  /**
   * System, z którym otworzyć analizę zaraz po zapisaniu. Podany - okno dostaje drugą komendę, „Zapisz i analizuj".
   *
   * Tylko symulacja go podaje: to ona ma wynik, którego nie wolno zgubić, więc analiza otwiera się w nowej karcie -
   * i ma sens otwierać ją od razu z tym systemem, którym te rozdania były licytowane.
   */
  analyseWithSystemId?: string;
}

/**
 * Keeps this deal on the user's account: the mark beside the analysis chip, and the dialog behind it.
 */
/*
 * On the card rather than on the bar above it, because what is being kept is this deal and the card is the only thing on
 * screen that is only ever one deal. It is drawn as a mark rather than as a labelled command: it sits next to `Analizuj`,
 * which is the loud one, and saving is not a thing anybody comes to the screen to do.
 */
export function SaveDealButton({ deal, vulnerability, analyseWithSystemId }: SaveDealButtonProps) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  const keep = (details: DealDetails) => saveDeal({
    name: details.name,
    tags: details.tags,
    comment: details.comment === '' ? null : details.comment,
    vulnerability,
    deal,
  });

  return (
    <>
      <Button
        iconOnly
        icon={SaveIcon}
        className={saved ? 'deal-save saved' : 'deal-save'}
        title={saved ? 'Rozdanie zapisane. Kliknij, aby zapisać ponownie.' : 'Zapisz rozdanie na swoim koncie'}
        aria-label="Zapisz rozdanie"
        onClick={() => setOpen(true)}
      />

      {!open ? null : (
        <DealDetailsDialog
          title="Zapisz rozdanie"
          initial={{ name: defaultName(deal), tags: '', comment: '' }}
          submitLabel="Zachowaj"
          busyLabel="Zapisuję…"
          onSubmit={(details) => keep(details).then(() => setSaved(true))}
          extra={analyseWithSystemId === undefined ? undefined : {
            label: 'Zapisz i analizuj',
            busyLabel: 'Zapisuję…',
            icon: SearchIcon,
            onSubmit: (details) => {
              /*
               * Karta jest zamawiana tutaj, a nie po zapisaniu: wtedy otwiera ją jeszcze kliknięcie użytkownika, a nie
               * odpowiedź serwera - a otwarcie karty długo po kliknięciu przeglądarki blokują jako wyskakujące okno.
               */
              const tab = window.open('', '_blank');

              return keep(details).then(
                (summary) => {
                  setSaved(true);
                  show(tab, analyzerLink(summary.id, 'analysis', true, analyseWithSystemId));
                },
                (reason: unknown) => {
                  tab?.close();
                  throw reason;
                },
              );
            },
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/**
 * Pokazuje adres w zamówionej karcie.
 */
/*
 * Adres musi być pełny: pusta karta stoi na `about:blank`, względem którego ścieżka aplikacji nie ma się do czego
 * odnieść. `opener` jest zrywany, żeby nowa karta nie miała dostępu do tej, z której wyszła.
 */
function show(tab: Window | null, path: string) {
  const address = new URL(path, window.location.origin).toString();

  if (tab === null) {
    window.open(address, '_blank', 'noopener');
    return;
  }

  tab.opener = null;
  tab.location.replace(address);
}

/** Something to recognise it by before the user types his own: what was played, on which board. */
function defaultName(deal: SimulationDealResult): string {
  const declarer = deal.contract.declarer === null || deal.contract.declarer === undefined ? '' : ` ${deal.contract.declarer}`;
  const contract = deal.contract.passed ? 'Pas' : `${deal.contract.label}${declarer}`;

  return `${contract} · rozdanie ${(Number(deal.index) || 0) + 1}`;
}
