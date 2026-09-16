import { useState } from 'react';
import type { SimulationDealResult, Vulnerability } from '@/api/models';
import { saveDeal } from '@/api/savedDeals';
import { SaveIcon } from '@/components/icons';
import { Button } from '@/ui';
import { DealDetailsDialog } from './DealDetailsDialog';
import './savedDeals.css';

/**
 * Keeps this deal on the user's account: the mark beside the analysis chip, and the dialog behind it.
 */
/*
 * On the card rather than on the bar above it, because what is being kept is this deal and the card is the only thing on
 * screen that is only ever one deal. It is drawn as a mark rather than as a labelled command: it sits next to `Analizuj`,
 * which is the loud one, and saving is not a thing anybody comes to the screen to do.
 */
export function SaveDealButton({ deal, vulnerability }: { deal: SimulationDealResult; vulnerability: Vulnerability }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);

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
          onSubmit={(details) => saveDeal({
            name: details.name,
            tags: details.tags,
            comment: details.comment === '' ? null : details.comment,
            vulnerability,
            deal,
          }).then(() => setSaved(true))}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/** Something to recognise it by before the user types his own: what was played, on which board. */
function defaultName(deal: SimulationDealResult): string {
  const declarer = deal.contract.declarer === null || deal.contract.declarer === undefined ? '' : ` ${deal.contract.declarer}`;
  const contract = deal.contract.passed ? 'Pas' : `${deal.contract.label}${declarer}`;

  return `${contract} · rozdanie ${(Number(deal.index) || 0) + 1}`;
}
