import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toNumber } from '@/api/models';
import type { SavedDealSummary } from '@/api/models';
import { HelpTip } from '@/components/HelpTip';
import { FilterIcon, SortIcon } from '@/components/icons';
import { BidCard, Chevron, ComboBoxField, Popup } from '@/ui';
import { vulnerabilityLabels } from '@/features/simulation/vulnerability';
/* The contract pill is the deal card's own; these lists show the same thing and must not draw a second version of it. */
import '@/ui/bridge/deal.css';
import './savedDeals.css';

const pageSizes = [25, 50, 100, 200];

export interface DealFilters {
  contract: string;
  tags: string;
  /** Only the list of deals other people shared has one. */
  sharedBy?: string;
}

/** Z której listy rozdań czytamy. Osobne strony mają po jednej; widok analizy sięga po obie. */
export type DealSource = 'mine' | 'shared';

const sourceLabels: Record<DealSource, string> = { mine: 'Moje rozdania', shared: 'Udostępnione mi' };

/**
 * What narrows a list of deals, behind one named control - the same arrangement the simulator filters its results with.
 */
/*
 * Fields on the bar itself would each need a label beside them, and a bar of labelled fields is a form, not a bar. In a
 * panel the label stands over its field where a label belongs, and the bar keeps to one row of controls.
 */
export function DealFilterMenu({ value, known, onChange, source, onSource }: {
  value: DealFilters;
  /** Keywords worth suggesting: the ones present in the list as it stands. */
  known: readonly string[];
  onChange: (value: DealFilters) => void;
  /** Tylko tam, gdzie jeden widok czyta z obu list - wtedy wybór listy jest pierwszym zawężeniem, jakie się robi. */
  source?: DealSource;
  onSource?: (source: DealSource) => void;
}) {
  const [suggesting, setSuggesting] = useState(false);

  const typed = lastWord(value.tags).toLowerCase();
  const chosen = value.tags.toLowerCase().split(/[\s,;]+/);
  const suggestions = typed === '' ? [] : known.filter((tag) => tag.startsWith(typed) && !chosen.includes(tag)).slice(0, 5);

  const count = [value.contract, value.tags, value.sharedBy ?? ''].filter((field) => field.trim() !== '').length;

  return (
    <Popup label="Filtry" icon={FilterIcon} count={count} scroll={false}>
      {source === undefined || onSource === undefined ? null : (
        <div className="ui-panel-section">
          <ComboBoxField
            label="Lista"
            value={source}
            options={(Object.keys(sourceLabels) as DealSource[]).map((key) => ({ value: key, label: sourceLabels[key] }))}
            onChange={onSource}
          />
        </div>
      )}

      <div className="ui-panel-section">
        <label className="ui-field">
          <span>
            Kontrakt
            <HelpTip>Poziom, kolor albo jedno i drugie: NT, 1S, 1d. Kilka warunków oddziel przecinkiem.</HelpTip>
          </span>
          <input type="text" value={value.contract} placeholder="3NT" onChange={(event) => onChange({ ...value, contract: event.target.value })} />
        </label>
      </div>

      <div className="ui-panel-section">
        <label className="ui-field">
          <span>Tagi</span>
          <input
            type="text"
            value={value.tags}
            placeholder="wtrącenie"
            onChange={(event) => { onChange({ ...value, tags: event.target.value }); setSuggesting(true); }}
            onFocus={() => setSuggesting(true)}
            /* Delayed, because a click on a suggestion takes the focus out of the field before it lands. */
            onBlur={() => window.setTimeout(() => setSuggesting(false), 120)}
          />
        </label>

        {!suggesting || suggestions.length === 0 ? null : (
          <div className="deal-tag-suggestions">
            {suggestions.map((tag) => (
              <button
                key={tag}
                type="button"
                className="small"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => { onChange({ ...value, tags: `${value.tags.slice(0, value.tags.length - typed.length)}${tag} ` }); setSuggesting(false); }}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {value.sharedBy === undefined ? null : (
        <div className="ui-panel-section">
          <label className="ui-field">
            <span>Udostępnione przez</span>
            <input type="text" value={value.sharedBy} placeholder="nazwa" onChange={(event) => onChange({ ...value, sharedBy: event.target.value })} />
          </label>
        </div>
      )}
    </Popup>
  );
}

/** The order of the list and how much of it is shown at once - the simulator's sort sheet, asking this list's questions. */
export function DealSortMenu({ oldestFirst, onOldestFirst, pageSize, onPageSize }: {
  oldestFirst: boolean;
  onOldestFirst: (value: boolean) => void;
  pageSize: number;
  onPageSize: (value: number) => void;
}) {
  return (
    <Popup label="Sortowanie" icon={SortIcon}>
      <div className="ui-panel-section">
        {[{ oldest: false, label: 'Najnowsze pierwsze' }, { oldest: true, label: 'Najstarsze pierwsze' }].map((option) => (
          <label key={option.label} className="ui-check">
            <input type="radio" name="deal-order" checked={oldestFirst === option.oldest} onChange={() => onOldestFirst(option.oldest)} />
            <span>{option.label}</span>
          </label>
        ))}
      </div>

      <div className="ui-panel-section">
        {pageSizes.map((size) => (
          <label key={size} className="ui-check">
            <input type="radio" name="deal-page-size" checked={pageSize === size} onChange={() => onPageSize(size)} />
            <span>{size} na stronie</span>
          </label>
        ))}
      </div>
    </Popup>
  );
}

/**
 * One kept deal: what was played, what it was called, and whatever the row's own list lets you do to it.
 */
/*
 * Wiersz, który gdzieś prowadzi, jest łączem na nazwie i płytką klikalną w całości - tak samo, jak kafelek narzędzia na
 * stronie startowej. Łącze jest po to, żeby dało się tam dojść z klawiatury i żeby czytnik ekranu miał co przeczytać;
 * cała płytka jest po to, że nikt nie celuje myszą w sam tytuł. Komendy wiersza zatrzymują kliknięcie u siebie.
 */
export function DealRow({ deal, extra, actions, to }: { deal: SavedDealSummary; extra?: React.ReactNode; actions: React.ReactNode; to?: string }) {
  const navigate = useNavigate();
  const level = toNumber(deal.level);
  const played = level !== null && deal.color !== null && deal.color !== undefined;

  return (
    <article
      className={to === undefined ? 'saved-deal' : 'saved-deal openable'}
      onClick={to === undefined ? undefined : () => void navigate(to)}
    >
      {/*
        * Ta sama płytka, co w nagłówku karty rozdania - łącznie z `ui-chip`, który daje jej wysokość i oddech. Bez niego
        * kontrakt w wierszu był samym rysunkiem wciśniętym w obrys.
        *
        * Sam kontrakt, bez miejsca, które go gra: wiersz listy odpowiada na pytanie „co to za rozdanie", a kto siedział
        * na rozgrywce, widać na karcie po jego otwarciu.
        */}
      <span className="ui-chip deal-contract">
        {!played ? deal.contract : <BidCard bid={{ color: deal.color!, value: level }} />}
      </span>

      <div className="saved-deal-body">
        <h2>{to === undefined ? deal.name : <Link to={to}>{deal.name}</Link>}</h2>
        <p className="saved-deal-meta">
          {new Date(deal.savedUtc).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })}
          {` · rozdaje ${deal.dealer} · po partii ${vulnerabilityLabels[deal.vulnerability]}`}
          {extra}
        </p>

        {deal.tags.length === 0 ? null : (
          <p className="saved-deal-tags">{deal.tags.map((tag) => <span key={tag}>{tag}</span>)}</p>
        )}

        {deal.comment === null || deal.comment === undefined || deal.comment === '' ? null : <p className="saved-deal-comment">{deal.comment}</p>}
      </div>

      {/* Komenda wiersza jest komendą wiersza, a nie skrótem do jego otwarcia. */}
      <div className="saved-deal-actions" onClick={(event) => event.stopPropagation()}>{actions}</div>
    </article>
  );
}

/**
 * The pages there are, and which one is being read.
 */
/*
 * Numbered rather than a pair of steps: with a hundred deals kept, "page 7 of 12" is a place somebody wants to go back
 * to, and stepping there one page at a time is not navigation. The window around the current page keeps the row short
 * enough for a phone; the ends are always reachable through the arrows.
 */
export function DealPager({ page, pages, busy, onPage }: { page: number; pages: number; busy: boolean; onPage: (page: number) => void }) {
  if (pages < 2) {
    return null;
  }

  const first = Math.max(1, Math.min(page - 2, pages - 4));
  const shown = Array.from({ length: Math.min(5, pages) }, (_, offset) => first + offset).filter((number) => number <= pages);

  return (
    <nav className="deal-pager" aria-label="Strony">
      <button type="button" className="small" disabled={busy || page <= 1} aria-label="Poprzednia strona" onClick={() => onPage(page - 1)}>
        <Chevron className="deal-pager-back" />
      </button>

      {shown.map((number) => (
        <button
          key={number}
          type="button"
          className="small"
          aria-current={number === page ? 'page' : undefined}
          disabled={busy}
          onClick={() => onPage(number)}
        >
          {number}
        </button>
      ))}

      <button type="button" className="small" disabled={busy || page >= pages} aria-label="Następna strona" onClick={() => onPage(page + 1)}>
        <Chevron />
      </button>
    </nav>
  );
}

/** The word still being typed: everything after the last separator, which is the only one suggesting can help with. */
function lastWord(tags: string): string {
  const separator = Math.max(tags.lastIndexOf(' '), tags.lastIndexOf(','), tags.lastIndexOf(';'));
  return tags.slice(separator + 1);
}
