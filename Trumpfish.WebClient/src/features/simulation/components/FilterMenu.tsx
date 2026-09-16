import { useState } from 'react';
import { CheckIcon, CloseIcon, FilterIcon } from '@/components/icons';
import { Popup } from '@/ui';
import type { DealFilters, GameFilterKey, SideFilterKey } from '../filters';
import { activeFilterCount, emptyFilters, gameFilterLabels, sideFilterLabels } from '../filters';

/**
 * Every way of narrowing the result set, in one sheet.
 */
/*
 * Edited as a draft and committed rather than applied on each keystroke: re-filtering a few thousand deals on every
 * character typed is work nobody asked for, and a list rearranging itself under a half-typed search is hard to aim at.
 *
 * Dismissing the sheet commits, which is the behaviour of a form that has no cancel. `Zastosuj` commits without
 * dismissing, for when the user wants to see the effect and keep adjusting.
 */
export function FilterMenu({ value, onChange }: { value: DealFilters; onChange: (next: DealFilters) => void }) {
  const [draft, setDraft] = useState<DealFilters>(value);

  /*
   * A fresh closure over the current draft on every render, handed to the popover as its `onClose`. The popover re-hangs
   * its dismissal listener whenever that changes, so whatever finally closes the sheet commits what is in it now rather
   * than what was in it when the listener went up.
   */
  const apply = () => onChange(draft);

  const clear = () => {
    setDraft(emptyFilters);
    onChange(emptyFilters);
  };

  const toggleGame = (key: GameFilterKey, on: boolean) =>
    setDraft((current) => ({
      ...current,
      games: on ? [...current.games, key] : current.games.filter((candidate) => candidate !== key),
    }));

  return (
    <Popup
      label="Filtry"
      icon={FilterIcon}
      count={activeFilterCount(value)}
      onClose={apply}
      footer={
        <>
          <button type="button" className="small" onClick={clear}>
            <CloseIcon />
            <span>Wyczyść</span>
          </button>
          <button type="button" className="small primary" onClick={apply}>
            <CheckIcon />
            <span>Zastosuj</span>
          </button>
        </>
      }
    >
      <div className="ui-panel-section">
        <div className="ui-panel-search">
          <input
            type="search"
            value={draft.bid}
            placeholder="Wyszukaj odzywkę…"
            aria-label="Wyszukaj odzywkę"
            onChange={(event) => setDraft((current) => ({ ...current, bid: event.target.value }))}
          />
          {draft.bid === '' ? null : (
            <button
              type="button"
              className="ui-panel-search-clear"
              aria-label="Wyczyść wyszukiwanie"
              onClick={() => setDraft((current) => ({ ...current, bid: '' }))}
            >
              <CloseIcon />
            </button>
          )}
        </div>
      </div>

      <div className="ui-panel-section">
        {(Object.keys(sideFilterLabels) as SideFilterKey[]).map((key) => (
          <label key={key} className="ui-check">
            <input
              type="radio"
              name="side-filter"
              checked={draft.side === key}
              onChange={() => setDraft((current) => ({ ...current, side: key }))}
            />
            <span>{sideFilterLabels[key]}</span>
          </label>
        ))}
      </div>

      <div className="ui-panel-section">
        {(Object.keys(gameFilterLabels) as GameFilterKey[]).map((key) => (
          <label key={key} className="ui-check">
            <input
              type="checkbox"
              checked={draft.games.includes(key)}
              onChange={(event) => toggleGame(key, event.target.checked)}
            />
            <span>{gameFilterLabels[key]}</span>
          </label>
        ))}
      </div>
    </Popup>
  );
}
