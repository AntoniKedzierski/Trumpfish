import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toNumber } from '@/api/models';
import type { SavedDealSummary } from '@/api/models';
import { listSavedDeals, listSharedDeals } from '@/api/savedDeals';
import { PlayIcon } from '@/components/icons';
import { ToolBar } from '@/components/ToolBar';
import { Button } from '@/ui';
import { DealFilterMenu, DealPager, DealRow, DealSortMenu } from '@/features/savedDeals/DealPieces';
import type { DealFilters, DealSource } from '@/features/savedDeals/DealPieces';
import { dealWord } from '@/features/savedDeals/dealWord';
import '@/features/savedDeals/savedDeals.css';
import { analyzerLink } from '../route';

/** Jeden wiersz listy, niezależnie od tego, z której listy pochodzi. */
interface PickerRow {
  key: string;
  deal: SavedDealSummary;
  extra?: React.ReactNode;
}

/**
 * Wybór rozdania do analizy: własne albo udostępnione, zawężane dokładnie tak samo, jak na stronach obu list.
 */
/*
 * Ten sam pasek, te same filtry, ten sam pager i ten sam wiersz - wszystko z `features/savedDeals/DealPieces.tsx`. Druga
 * lista rozdań napisana od nowa rozjechałaby się z tamtymi dwiema tego dnia, w którym ktoś dołoży trzeci filtr.
 */
export function DealPicker() {
  const navigate = useNavigate();

  const [source, setSource] = useState<DealSource>('mine');
  const [filters, setFilters] = useState<DealFilters>({ contract: '', tags: '' });
  const [oldestFirst, setOldestFirst] = useState(false);
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<PickerRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [answered, setAnswered] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback(() => {
    setBusy(true);
    setError(null);

    const query = { contract: filters.contract, tags: filters.tags, oldestFirst, page, pageSize };

    const answer = source === 'mine'
      ? listSavedDeals(query).then((result) => ({
        total: toNumber(result.total) ?? 0,
        page: toNumber(result.page) ?? page,
        rows: result.deals.map((deal): PickerRow => ({ key: deal.id, deal })),
      }))
      : listSharedDeals({ ...query, sharedBy: filters.sharedBy }).then((result) => ({
        total: toNumber(result.total) ?? 0,
        page: toNumber(result.page) ?? page,
        rows: result.deals.map((shared): PickerRow => ({
          key: shared.shareId,
          deal: shared.deal,
          extra: <> · udostępnił(a) <strong>{shared.sharedBy}</strong>, {new Date(shared.sharedUtc).toLocaleDateString('pl-PL')}</>,
        })),
      }));

    answer
      .then((result) => { setRows(result.rows); setTotal(result.total); setAnswered(result.page); })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => setBusy(false));
  }, [source, filters, oldestFirst, page, pageSize]);

  // Wpisane filtry pyta się, kiedy pisanie ustanie; reszta to decyzje i pyta się o nie od razu.
  useEffect(() => {
    const timer = window.setTimeout(ask, 250);
    return () => window.clearTimeout(timer);
  }, [ask]);

  const known = useMemo(() => [...new Set((rows ?? []).flatMap((row) => row.deal.tags))].sort(), [rows]);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const narrowed = filters.contract !== '' || filters.tags !== '' || (filters.sharedBy ?? '') !== '';

  // Węższe pytanie zaczyna się od własnej pierwszej strony, a nie od tej, na której stało poprzednie.
  const narrow = (change: () => void) => {
    change();
    setPage(1);
  };

  /* Druga lista pyta o jedno pole więcej, więc pole na nią przychodzi razem ze zmianą listy i razem z nią znika. */
  const changeSource = (next: DealSource) => narrow(() => {
    setSource(next);
    setFilters((current) => next === 'shared'
      ? { contract: current.contract, tags: current.tags, sharedBy: '' }
      : { contract: current.contract, tags: current.tags });
  });

  return (
    <>
      <ToolBar
        status={
          <>
            {busy ? <span className="status">Szukam…</span> : null}
            {error === null ? null : <span className="status error">{error}</span>}
            {rows === null ? null : <span>{total} {dealWord(total)}</span>}
          </>
        }
      >
        <DealFilterMenu
          value={filters}
          known={known}
          onChange={(value) => narrow(() => setFilters(value))}
          source={source}
          onSource={changeSource}
        />
        <DealSortMenu
          oldestFirst={oldestFirst}
          onOldestFirst={(value) => narrow(() => setOldestFirst(value))}
          pageSize={pageSize}
          onPageSize={(value) => narrow(() => setPageSize(value))}
        />
      </ToolBar>

      <div className="saved-list">
        <p className="analyzer-hint">
          Kliknij rozdanie, żeby obejrzeć je ze wszystkimi kartami. Strzałką otworzysz je w trybie replay: widzisz wtedy
          tylko swoje karty i licytujesz je od nowa.
        </p>

        {rows !== null && rows.length === 0 ? (
          <p className="saved-empty">{emptyWords(source, narrowed)}</p>
        ) : (
          (rows ?? []).map((row) => (
            <DealRow
              key={row.key}
              deal={row.deal}
              extra={row.extra}
              to={analyzerLink(row.deal.id)}
              actions={
                <Button
                  iconOnly
                  icon={PlayIcon}
                  className="deal-save"
                  title="Rozegraj licytację od nowa - widzisz tylko swoje karty"
                  aria-label="Rozegraj licytację od nowa"
                  onClick={() => void navigate(analyzerLink(row.deal.id, 'replay'))}
                />
              }
            />
          ))
        )}

        <DealPager page={answered} pages={pages} busy={busy} onPage={setPage} />
      </div>
    </>
  );
}

function emptyWords(source: DealSource, narrowed: boolean): string {
  if (narrowed) {
    return 'Żadne rozdanie nie pasuje do tych warunków.';
  }

  return source === 'mine'
    ? 'Nie masz jeszcze zapisanych rozdań. Zapisuje się je dyskietką na karcie rozdania - w symulacji albo w ćwiczeniu.'
    : 'Nikt nie udostępnił ci jeszcze żadnego rozdania.';
}
