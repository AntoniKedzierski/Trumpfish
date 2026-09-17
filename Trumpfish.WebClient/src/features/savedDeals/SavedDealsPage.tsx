import { useCallback, useEffect, useMemo, useState } from 'react';
import { toNumber } from '@/api/models';
import type { SavedDealPage, SavedDealSummary } from '@/api/models';
import { deleteSavedDeal, listSavedDeals, updateSavedDeal } from '@/api/savedDeals';
import { PencilIcon, ShareIcon, TrashIcon } from '@/components/icons';
import { ToolBar } from '@/components/ToolBar';
import { Button, ConfirmDialog } from '@/ui';
import { analyzerLink } from '@/features/dealAnalyzer/route';
import { DealDetailsDialog } from './DealDetailsDialog';
import { DealFilterMenu, DealPager, DealRow, DealSortMenu } from './DealPieces';
import type { DealFilters } from './DealPieces';
import { dealWord } from './dealWord';
import { ShareDealDialog } from './ShareDealDialog';
import './savedDeals.css';

/**
 * Everything the user has kept: one page of it, narrowed by what was played and by his own keywords.
 */
/*
 * The list is the server's answer and nothing else - the page holds what was asked for, not a copy of the rows it was
 * answered with. Every control on the bar changes the question and the question is asked again, which is what keeps the
 * pager, the filters and the order from ever disagreeing about what is on screen.
 */
export function SavedDealsPage() {
  const [filters, setFilters] = useState<DealFilters>({ contract: '', tags: '' });
  const [oldestFirst, setOldestFirst] = useState(false);
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  const [answer, setAnswer] = useState<SavedDealPage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<SavedDealSummary | null>(null);
  const [sharing, setSharing] = useState<SavedDealSummary | null>(null);
  const [removing, setRemoving] = useState<SavedDealSummary | null>(null);

  const ask = useCallback(() => {
    setBusy(true);
    setError(null);
    listSavedDeals({ contract: filters.contract, tags: filters.tags, oldestFirst, page, pageSize })
      .then(setAnswer)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => setBusy(false));
  }, [filters, oldestFirst, page, pageSize]);

  // Typed filters are asked for once the typing stops; everything else is a decision and is asked for at once.
  useEffect(() => {
    const timer = window.setTimeout(ask, 250);
    return () => window.clearTimeout(timer);
  }, [ask]);

  /*
   * Suggested from the answer rather than from the account: what helps here is the keywords that would actually narrow
   * this list, which is a different set from every keyword the user has ever typed.
   */
  const known = useMemo(() => [...new Set((answer?.deals ?? []).flatMap((deal) => deal.tags))].sort(), [answer]);

  const total = toNumber(answer?.total) ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  // A narrower question starts at its own first page rather than at whatever page the previous one was on.
  const narrow = (change: () => void) => {
    change();
    setPage(1);
  };

  const remove = (deal: SavedDealSummary) => {
    setBusy(true);
    deleteSavedDeal(deal.id)
      .then(() => { setRemoving(null); ask(); })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => setBusy(false));
  };

  return (
    <div className="saved-deals">
      <h1 className="sr-only">Moje zapisane rozdania</h1>

      <ToolBar
        status={
          <>
            {busy ? <span className="status">Szukam…</span> : null}
            {error === null ? null : <span className="status error">{error}</span>}
            {answer === null ? null : <span>{total} {dealWord(total)}</span>}
          </>
        }
      >
        <DealFilterMenu value={filters} known={known} onChange={(value) => narrow(() => setFilters(value))} />
        <DealSortMenu
          oldestFirst={oldestFirst}
          onOldestFirst={(value) => narrow(() => setOldestFirst(value))}
          pageSize={pageSize}
          onPageSize={(value) => narrow(() => setPageSize(value))}
        />
      </ToolBar>

      <div className="saved-list">
        {answer !== null && answer.deals.length === 0 ? (
          <p className="saved-empty">
            {filters.contract === '' && filters.tags === ''
              ? 'Nie masz jeszcze zapisanych rozdań. Zapisuje się je dyskietką na karcie rozdania - w symulacji albo w ćwiczeniu.'
              : 'Żadne zapisane rozdanie nie pasuje do tych warunków.'}
          </p>
        ) : (
          (answer?.deals ?? []).map((deal) => (
            <DealRow
              key={deal.id}
              deal={deal}
              /* Kliknięcie w wiersz otwiera rozdanie tam, gdzie się je ogląda - w widoku analizy. */
              to={analyzerLink(deal.id)}
              actions={
                <>
                  <Button iconOnly icon={PencilIcon} className="deal-save" title="Edytuj nazwę, tagi i komentarz" aria-label="Edytuj" onClick={() => setEditing(deal)} />
                  <Button iconOnly icon={ShareIcon} className="deal-save" title="Udostępnij znajomym" aria-label="Udostępnij" onClick={() => setSharing(deal)} />
                  <Button iconOnly icon={TrashIcon} variant="danger" className="deal-save" title="Usuń zapisane rozdanie" aria-label="Usuń" onClick={() => setRemoving(deal)} />
                </>
              }
            />
          ))
        )}

        <DealPager page={toNumber(answer?.page) ?? page} pages={pages} busy={busy} onPage={setPage} />
      </div>

      {editing === null ? null : (
        <DealDetailsDialog
          title="Edytuj zapisane rozdanie"
          initial={{ name: editing.name, tags: editing.tags.join(' '), comment: editing.comment ?? '' }}
          submitLabel="Zapisz"
          busyLabel="Zapisuję…"
          onSubmit={(details) => updateSavedDeal(editing.id, {
            name: details.name,
            tags: details.tags,
            comment: details.comment === '' ? null : details.comment,
          }).then(ask)}
          onClose={() => setEditing(null)}
        />
      )}

      {sharing === null ? null : <ShareDealDialog deal={sharing} onClose={() => setSharing(null)} />}

      {removing === null ? null : (
        <ConfirmDialog
          title="Usunąć rozdanie?"
          question={`„${removing.name}” zniknie razem z komentarzem, tagami i każdym udostępnieniem. Tego nie da się cofnąć.`}
          confirmLabel="Usuń"
          confirmIcon={TrashIcon}
          danger
          busy={busy}
          onConfirm={() => remove(removing)}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  );
}
