import type { BiddingSystemSummary } from '@/api/models';
import { SettingsIcon } from '@/components/icons';
import { Popover } from '@/components/Popover';
import { SystemPicker } from '@/components/SystemPicker';

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
  // The trigger names the system that will be bidding: it is the one setting in here that decides what a run means.
  const chosen = systems.find((system) => system.id === systemId);

  return (
    <Popover label={chosen?.name ?? 'Konfiguracja'} icon={<SettingsIcon />} scrollBody={false}>
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

const maxDeals = 5000;

function clampCount(value: number): number {
  return Number.isFinite(value) ? Math.min(maxDeals, Math.max(1, Math.trunc(value))) : 1;
}
