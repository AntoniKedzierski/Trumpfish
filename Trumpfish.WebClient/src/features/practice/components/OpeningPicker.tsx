import { BidCard, ComboBox, type ComboBoxOption } from '@/ui';
import type { OpeningChoice } from '../openings';

interface OpeningPickerProps {
  /** Node id of the chosen opening, empty for none. */
  value: string;
  openings: readonly OpeningChoice[];
  onChange: (nodeId: string) => void;
  /** What the empty choice is called - a setup screen deals without conditions, a filter keeps every deal. */
  noneLabel?: string;
}

/**
 * The opening list: every opening of the system, drawn the way bids are drawn everywhere else and followed by its meaning, which
 * is what tells three different 1♣ apart.
 */
/*
 * Shared by the solo and the duo table and by the simulation filters, so the one list reads - and behaves - the same everywhere.
 */
export function OpeningPicker({ value, openings, onChange, noneLabel = 'Wszystkie - karty bez warunków' }: OpeningPickerProps) {
  const options: ComboBoxOption<string>[] = [
    { value: '', label: noneLabel },
    ...openings.map((choice) => ({
      value: choice.nodeId,
      label: `${choice.label} · ${choice.meaning}`,
      // The string is what the option is announced and titled by; this is what it looks like.
      labelNode: (
        <>
          <BidCard bid={{ type: choice.type, color: choice.color, value: choice.level }} />
          {` · ${choice.meaning}`}
        </>
      ),
    })),
  ];

  return <ComboBox value={value} options={options} onChange={onChange} disabled={openings.length === 0} />;
}
