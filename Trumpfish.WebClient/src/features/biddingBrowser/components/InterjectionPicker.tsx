import { useEffect, useRef, useState } from 'react';
import { TrashIcon } from '@/components/icons';
import '@/ui/comboBox.css';
import { interjectionOptions, isInterjectionLegal, type InterjectedCall, type InterjectionOption } from '../interjection';
import { formatInterjection, sameInterjection, sortInterjections, type EditableBidNode, type InterjectionBid } from '../model';
import { BidCard } from '@/ui';
import { InterjectionList } from './InterjectionList';

/** The field is a narrow column; past this many calls it says how many more there are, and the tooltip names them all. */
const shownInField = 3;

interface InterjectionPickerProps {
  value: readonly InterjectionBid[];
  /** Bids said before the edited one, from the root down to its parent - they bound the interjections from below. */
  ancestors: readonly EditableBidNode[];
  /** The edited bid itself - it bounds the interjections from above, being said after them. */
  call: InterjectedCall;
  onChange: (interjections: InterjectionBid[]) => void;
}

/**
 * Looks like a `Select`, but instead of a list it drops a bidding box: seven rows of levels times five suits,
 * plus a final row with the double and a bin clearing the field. Illegal interjections stay visible, only dimmed.
 *
 * Every cell toggles one call in or out of the list, so the box stays open until a click elsewhere or Escape closes it.
 * A chosen call that is no longer legal - the bid was lowered below it, say - is not dropped silently: the field turns red
 * and the cell stays chosen, and clicking it removes it.
 */
export function InterjectionPicker({ value, ancestors, call, onChange }: InterjectionPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current !== null && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const isChosen = (bid: InterjectionBid) => value.some((chosen) => sameInterjection(chosen, bid));
  const conflict = value.some((chosen) => !isInterjectionLegal(ancestors, call, chosen));

  const toggle = (option: InterjectionOption) => {
    if (option.kind === 'clear') {
      onChange([]);
      return;
    }

    const bid = option.bid;
    if (bid === null) {
      return;
    }

    if (isChosen(bid)) {
      onChange(value.filter((chosen) => !sameInterjection(chosen, bid)));
    }
    else if (option.available) {
      onChange(sortInterjections([...value, bid]));
    }
  };

  return (
    <div ref={rootRef} className="ui-combo interjection-picker" onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}>
      <button
        type="button"
        className={`ui-combo-field${open ? ' open' : ''}${conflict ? ' conflict' : ''}`}
        title={value.length === 0 ? undefined : value.map(formatInterjection).join(', ')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className={`ui-combo-value${value.length > 0 ? '' : ' placeholder'}`}>
          {value.length > 0 ? <InterjectionList interjections={value} limit={shownInField} /> : 'brak wtrącenia'}
        </span>
      </button>

      {open && (
        <div className="interjection-popup" role="dialog" aria-label="Wtrącenia przeciwnika">
          {interjectionOptions(ancestors, call).map((option, index) => (
            <InterjectionCell key={index} option={option} chosen={option.bid !== null && isChosen(option.bid)} onClick={() => toggle(option)} />
          ))}
        </div>
      )}
    </div>
  );
}

function InterjectionCell({ option, chosen, onClick }: { option: InterjectionOption; chosen: boolean; onClick: () => void }) {
  if (option.kind === 'empty') {
    return <span className="interjection-cell empty" />;
  }

  if (option.kind === 'clear') {
    return (
      <button type="button" className="interjection-cell clear" title="Wyczyść wtrącenia" onClick={onClick}>
        <TrashIcon />
      </button>
    );
  }

  if (option.bid === null) {
    return <span className="interjection-cell empty" />;
  }

  // A chosen call stays clickable even when it is no longer legal, since clicking it is how it gets removed.
  const className = `interjection-cell${chosen ? ' chosen' : ''}${option.available ? '' : ' unavailable'}`;
  return (
    <button type="button" className={className} disabled={!option.available && !chosen} aria-pressed={chosen} onClick={onClick}>
      <BidCard bid={option.bid} />
    </button>
  );
}
