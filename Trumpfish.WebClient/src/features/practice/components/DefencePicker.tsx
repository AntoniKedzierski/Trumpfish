import { Fragment } from 'react';
import { BidCard, ComboBox, type ComboBoxOption } from '@/ui';
import type { DefenceChoice } from '../openings';

interface DefencePickerProps {
  /** Node id of the chosen defence, empty for none. */
  value: string;
  defences: readonly DefenceChoice[];
  onChange: (nodeId: string) => void;
  /** What the empty choice is called - a setup screen practises no defence, a filter keeps every deal. */
  noneLabel?: string;
}

/** How many of the opponents' bids are drawn before the rest is only counted - 3NT can answer nine of them. */
const shownAfter = 3;

/**
 * The defence list: every defence of the system, drawn the way bids are drawn everywhere else, followed by the opponents' bids it
 * answers and its meaning - which is what tells a takeout double after 1♣ from a strong one.
 */
/*
 * Shared by the solo and the duo table and by the simulation filters, so the one list reads - and behaves - the same everywhere.
 */
export function DefencePicker({ value, defences, onChange, noneLabel = 'Bez obrony' }: DefencePickerProps) {
  const options: ComboBoxOption<string>[] = [
    { value: '', label: noneLabel },
    ...defences.map((choice) => ({
      value: choice.nodeId,
      label: `${choice.label} po ${choice.after.map((bid) => bid.label).join(', ')} · ${choice.meaning}`,
      // The string is what the option is announced and titled by; this is what it looks like.
      labelNode: <DefenceLabel choice={choice} />,
    })),
  ];

  return <ComboBox value={value} options={options} onChange={onChange} disabled={defences.length === 0} />;
}

function DefenceLabel({ choice }: { choice: DefenceChoice }) {
  const shown = choice.after.slice(0, shownAfter);
  const hidden = choice.after.length - shown.length;

  return (
    <>
      <BidCard bid={{ type: choice.type, color: choice.color, value: choice.level }} />
      {' po '}
      {shown.map((bid, index) => (
        <Fragment key={index}>
          {index > 0 ? ', ' : null}
          <BidCard bid={{ type: bid.type, color: bid.color, value: bid.level }} />
        </Fragment>
      ))}
      {hidden > 0 ? ` +${hidden}` : null}
      {` · ${choice.meaning}`}
    </>
  );
}
