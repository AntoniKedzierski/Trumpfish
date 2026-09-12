import { useEffect, useRef, useState } from 'react';
import type { BiddingSystemSummary } from '@/api/models';
import { SettingsIcon } from '@/components/icons';
import { Popover } from '@/components/Popover';
import { Chevron } from '@/components/Select';
import './ConfigMenu.css';

interface ConfigMenuProps {
  systems: readonly BiddingSystemSummary[];
  systemId: string;
  onSystemId: (id: string) => void;
  dealCount: number;
  onDealCount: (count: number) => void;
  seed: string;
  onSeed: (seed: string) => void;
  disabled: boolean;
}

/**
 * What the run is made of: which system bids, how many deals, and the seed behind them.
 */
/*
 * Nothing here is staged - a change takes effect as it is made, so dismissing the panel decides nothing and reopening it
 * shows what is currently set. That is why it is given no `onClose`.
 */
export function ConfigMenu({ systems, systemId, onSystemId, dealCount, onDealCount, seed, onSeed, disabled }: ConfigMenuProps) {
  return (
    <Popover label="Konfiguracja" icon={<SettingsIcon />} scrollBody={false}>
      <div className="popover-section">
        <SystemPicker systems={systems} systemId={systemId} onSystemId={onSystemId} disabled={disabled} />
      </div>

      <div className="popover-section">
        <label className="popover-field">
          <span>Liczba rozdań</span>
          <input
            type="number"
            min={1}
            max={maxDeals}
            value={dealCount}
            disabled={disabled}
            onChange={(event) => onDealCount(clampCount(Number(event.target.value)))}
          />
        </label>

        <label className="popover-field">
          <span>Ziarno</span>
          <input
            type="text"
            value={seed}
            placeholder="Losowe…"
            disabled={disabled}
            onChange={(event) => onSeed(event.target.value)}
          />
        </label>
      </div>
    </Popover>
  );
}

/**
 * The system in use, and the list to change it for.
 */
/*
 * One piece of markup, two behaviours. Where there is a real pointer the list flies out beside the row on hover, the way a
 * submenu does. Where there is not - a phone, a tablet - there is no hover to open it with and no room to fly out into, so
 * the same list opens in place, underneath the row, on a tap. Which of the two applies is decided in the stylesheet.
 */
function SystemPicker({
  systems,
  systemId,
  onSystemId,
  disabled,
}: {
  systems: readonly BiddingSystemSummary[];
  systemId: string;
  onSystemId: (id: string) => void;
  disabled: boolean;
}) {
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
        {/* The name takes the label's place once there is one to show, which is nearly always. */}
        <span className={chosen === undefined ? 'picker-value empty' : 'picker-value'}>
          {chosen?.name ?? 'System'}
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
            </button>
          ))
        )}
      </div>
    </div>
  );
}

const maxDeals = 5000;

function clampCount(value: number): number {
  return Number.isFinite(value) ? Math.min(maxDeals, Math.max(1, Math.trunc(value))) : 1;
}
