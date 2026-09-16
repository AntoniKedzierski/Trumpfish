import { useCallback, useEffect, useMemo, useState } from 'react';
import { toNumber } from '@/api/models';
import type { SharedDealPage, SharedDealSummary } from '@/api/models';
import { listSharedDeals, removeSharedDeal } from '@/api/savedDeals';
import { TrashIcon } from '@/components/icons';
import { ToolBar } from '@/components/ToolBar';
import { Button, ConfirmDialog } from '@/ui';
import { DealFilterMenu, DealPager, DealRow, DealSortMenu } from './DealPieces';
import type { DealFilters } from './DealPieces';
import { dealWord } from './dealWord';
import './savedDeals.css';

/**
 * The deals other people have handed on. Read exactly like a user's own list, with one filter more and two commands less.
 */
/*
 * What is listed here is permission rather than property: the deal belongs to whoever kept it, and the only thing this
 * page can do to one is stop receiving it. Editing and sharing are the owner's, which is why those two commands are not
 * on these rows at all rather than being here and refused.
 */
export function SharedDealsPage() {
  const [filters, setFilters] = useState<DealFilters>({ contract: '', tags: '', sharedBy: '' });
  const [oldestFirst, setOldestFirst] = useState(false);
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  const [answer, setAnswer] = useState<SharedDealPage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropping, setDropping] = useState<SharedDealSummary | null>(null);

  const ask = useCallback(() => {
    setBusy(true);
    setError(null);
    listSharedDeals({ contract: filters.contract, tags: filters.tags, sharedBy: filters.sharedBy, oldestFirst, page, pageSize })
      .then(setAnswer)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => setBusy(false));
  }, [filters, oldestFirst, page, pageSize]);

  // Typed filters are asked for once the typing stops; everything else is a decision and is asked for at once.
  useEffect(() => {
    const timer = window.setTimeout(ask, 250);
    return () => window.clearTimeout(timer);
  }, [ask]);

  // The keywords worth suggesting here are the ones on the list as it stands - they are other people's, not the user's own.
  const known = useMemo(() => [...new Set((answer?.deals ?? []).flatMap((shared) => shared.deal.tags))].sort(), [answer]);

  const total = toNumber(answer?.total) ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const narrow = (change: () => void) => {
    change();
    setPage(1);
  };

  const drop = (shared: SharedDealSummary) => {
    setBusy(true);
    removeSharedDeal(shared.shareId)
      .then(() => { setDropping(null); ask(); })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => setBusy(false));
  };

  return (
    <div className="saved-deals">
      <h1 className="sr-only">Udostępnione rozdania</h1>

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
            {filters.contract === '' && filters.tags === '' && filters.sharedBy === ''
              ? 'Nikt nie udostępnił ci jeszcze żadnego rozdania.'
              : 'Żadne udostępnione rozdanie nie pasuje do tych warunków.'}
          </p>
        ) : (
          (answer?.deals ?? []).map((shared) => (
            <DealRow
              key={shared.shareId}
              deal={shared.deal}
              /* The list is ordered by when it was handed over, so that is the date the row says. */
              extra={<> · udostępnił(a) <strong>{shared.sharedBy}</strong>, {new Date(shared.sharedUtc).toLocaleDateString('pl-PL')}</>}
              actions={
                <Button
                  iconOnly
                  icon={TrashIcon}
                  variant="danger"
                  className="deal-save"
                  title="Zrezygnuj z tego udostępnienia"
                  aria-label="Zrezygnuj"
                  onClick={() => setDropping(shared)}
                />
              }
            />
          ))
        )}

        <DealPager page={toNumber(answer?.page) ?? page} pages={pages} busy={busy} onPage={setPage} />
      </div>

      {dropping === null ? null : (
        <ConfirmDialog
          title="Zrezygnować z rozdania?"
          question={`„${dropping.deal.name}” zniknie z twojej listy. U ${dropping.sharedBy} zostaje - to jego rozdanie.`}
          confirmLabel="Zrezygnuj"
          confirmIcon={TrashIcon}
          danger
          busy={busy}
          onConfirm={() => drop(dropping)}
          onClose={() => setDropping(null)}
        />
      )}
    </div>
  );
}
