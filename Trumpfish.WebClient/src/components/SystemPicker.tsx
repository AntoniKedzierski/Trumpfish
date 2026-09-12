import { useEffect, useRef, useState } from 'react';
import type { BiddingSystemSummary } from '@/api/models';
import { Chevron } from './Select';
import './SystemPicker.css';

interface SystemPickerProps {
  systems: readonly BiddingSystemSummary[];
  /** The system in use, or an empty string where none has been chosen. */
  systemId: string;
  onSystemId: (id: string) => void;
  disabled?: boolean;
  /** Stands on the row until a system is chosen. */
  placeholder?: string;
  /** A word about each system, set after its name in the list. */
  note?: (system: BiddingSystemSummary) => string | undefined;
}

/**
 * The system in use, and the list to change it for.
 */
/*
 * Shared between the simulator and the browser, which ask the same question of the same list and should not answer it two
 * different ways.
 *
 * The row reads as the value it holds rather than as a button, and the list opens underneath it - the same on a desktop as
 * on a phone. It used to fly out to the side on a pointer device, which put it outside the panel it belongs to and made it
 * the one control in the application that behaved differently depending on what was pointing at it.
 */
export function SystemPicker({ systems, systemId, onSystemId, disabled = false, placeholder = 'System', note }: SystemPickerProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  const chosen = systems.find((system) => system.id === systemId);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (root.current !== null && !root.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <div className="picker" ref={root}>
      <button
        type="button"
        className="picker-row"
        aria-expanded={open}
        disabled={disabled || systems.length === 0}
        onClick={() => setOpen((was) => !was)}
      >
        {/* The name takes the placeholder's place once there is one to show, which is nearly always. */}
        <span className={chosen === undefined ? 'picker-value empty' : 'picker-value'}>
          {chosen?.name ?? placeholder}
        </span>
        <Chevron className="picker-chevron" />
      </button>

      <div className="picker-list">
        {systems.length === 0 ? (
          <p className="picker-empty">Brak zapisanych systemów.</p>
        ) : (
          systems.map((system) => (
            <button
              key={system.id}
              type="button"
              className="picker-option"
              aria-current={system.id === systemId ? 'true' : undefined}
              title={system.name}
              onClick={() => {
                onSystemId(system.id);
                setOpen(false);
              }}
            >
              <span>{system.name}</span>
              {note?.(system) === undefined ? null : <span className="picker-note">{note(system)}</span>}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
