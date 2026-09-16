import { SortIcon } from '@/components/icons';
import { Popup } from '@/ui';
import type { SortDirection, SortKey } from '../sorting';
import { sortDirectionLabels, sortKeyLabels } from '../sorting';

/**
 * The sort order, in the same kind of sheet the filters use.
 */
/*
 * Applied as it is picked rather than on dismissal: reordering a list that is already in memory is instant, and unlike a
 * filter there is nothing here to build up before it makes sense to look at the result.
 */
export function SortMenu({
  sortKey,
  direction,
  onSortKey,
  onDirection,
}: {
  sortKey: SortKey;
  direction: SortDirection;
  onSortKey: (key: SortKey) => void;
  onDirection: (direction: SortDirection) => void;
}) {
  return (
    <Popup label="Sortowanie" icon={SortIcon}>
      <div className="ui-panel-section">
        {(Object.keys(sortKeyLabels) as SortKey[]).map((key) => (
          <label key={key} className="ui-check">
            <input type="radio" name="sort-key" checked={sortKey === key} onChange={() => onSortKey(key)} />
            <span>{sortKeyLabels[key]}</span>
          </label>
        ))}
      </div>

      <div className="ui-panel-section">
        {(Object.keys(sortDirectionLabels) as SortDirection[]).map((key) => (
          <label key={key} className="ui-check">
            <input type="radio" name="sort-direction" checked={direction === key} onChange={() => onDirection(key)} />
            <span>{sortDirectionLabels[key]}</span>
          </label>
        ))}
      </div>
    </Popup>
  );
}
