import { useEffect, useRef, useState } from 'react';
import { TrashIcon } from '@/components/icons';
import '@/ui/comboBox.css';
import { interjectionOptions, type InterjectionOption } from '../interjection';
import type { EditableBidNode, InterjectionBid } from '../model';
import { BidCard } from '@/ui';

interface InterjectionPickerProps {
  value: InterjectionBid | null | undefined;
  /** Bids said before the edited one, from the root down to its parent - they decide which interjections are still legal. */
  ancestors: readonly EditableBidNode[];
  onChange: (interjection: InterjectionBid | null) => void;
}

/**
 * Looks like a `Select`, but instead of a list it drops a bidding box: seven rows of levels times five suits,
 * plus a final row with the double and a bin clearing the field. Illegal interjections stay visible, only dimmed.
 */
export function InterjectionPicker({ value, ancestors, onChange }: InterjectionPickerProps) {
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

  const commit = (option: InterjectionOption) => {
    if (option.kind === 'empty' || (option.bid !== null && !option.available)) {
      return;
    }

    onChange(option.bid);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="ui-combo interjection-picker" onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}>
      <button type="button" className={`ui-combo-field${open ? ' open' : ''}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className={`ui-combo-value${value ? '' : ' placeholder'}`}>
          {value ? <BidCard bid={value} /> : 'brak wtrącenia'}
        </span>
      </button>

      {open && (
        <div className="interjection-popup" role="dialog" aria-label="Wtrącenie przeciwnika">
          {interjectionOptions(ancestors).map((option, index) => (
            <InterjectionCell key={index} option={option} onClick={() => commit(option)} />
          ))}
        </div>
      )}
    </div>
  );
}

function InterjectionCell({ option, onClick }: { option: InterjectionOption; onClick: () => void }) {
  if (option.kind === 'empty') {
    return <span className="interjection-cell empty" />;
  }

  if (option.kind === 'clear') {
    return (
      <button type="button" className="interjection-cell clear" title="Wyczyść wtrącenie" onClick={onClick}>
        <TrashIcon />
      </button>
    );
  }

  if (option.bid === null) {
    return <span className="interjection-cell empty" />;
  }

  return (
    <button type="button" className={`interjection-cell${option.available ? '' : ' unavailable'}`} disabled={!option.available} onClick={onClick}>
      <BidCard bid={option.bid} />
    </button>
  );
}
