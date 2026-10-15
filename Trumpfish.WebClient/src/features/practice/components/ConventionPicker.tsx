import { useState } from 'react';
import { BidCard, Button, ComboBox, Dialog, type ComboBoxOption } from '@/ui';
import { CloseIcon } from '@/components/icons';
import { longPressDelay, useLongPress } from '@/components/useLongPress';
import { placeOf, type ConventionChoice, type ConventionPlace } from '../conventions';
import type { OpeningChoice } from '../openings';

interface ConventionPickerProps {
  /** Matching key of the chosen convention, empty for none. */
  value: string;
  conventions: readonly ConventionChoice[];
  onChange: (key: string) => void;
  /** What the empty choice is called - a setup screen practises no convention, a filter keeps every deal. */
  noneLabel?: string;
}

/**
 * The convention list of a setup screen. Every name is followed by where it comes up: the opening itself - drawn the way bids
 * are drawn everywhere else, with its meaning from the system - when there is one, the bid alone when it is several variants
 * of the same bid, and a count otherwise. A count opens the full list of openings, and so does holding an option down, which
 * is how it is reached on a phone. A convention no branch leads to is shown in red and cannot be chosen.
 */
/*
 * Shared by the solo and the duo table and by the simulation filters, so the one list reads - and behaves - the same everywhere.
 */
export function ConventionPicker({ value, conventions, onChange, noneLabel = 'Bez konwencji' }: ConventionPickerProps) {
  const [details, setDetails] = useState<ConventionChoice | null>(null);

  const options: ComboBoxOption<string>[] = [
    { value: '', label: noneLabel },
    ...conventions.map((choice) => {
      const place = placeOf(choice);
      return {
        value: choice.key,
        label: `${choice.label} · ${placeText(place)}`,
        labelNode: <ConventionLabel choice={choice} place={place} onDetails={() => setDetails(choice)} />,
        // The closed field is a button already, so what it shows carries no link of its own.
        valueNode: <ConventionLabel choice={choice} place={place} />,
        disabled: place.kind === 'unreachable',
      };
    }),
  ];

  return (
    <>
      <ComboBox value={value} options={options} onChange={onChange} disabled={conventions.length === 0} />
      {details === null ? null : <ConventionOpenings choice={details} onClose={() => setDetails(null)} />}
    </>
  );
}

/** One option of the list. Held down, it asks for the openings - the same as clicking the count, for a finger that cannot aim. */
function ConventionLabel({ choice, place, onDetails }: { choice: ConventionChoice; place: ConventionPlace; onDetails?: () => void }) {
  const canExplain = onDetails !== undefined && choice.openings.length > 0;
  const { holding, handlers } = useLongPress(() => onDetails?.(), { delay: longPressDelay });

  const more = (text: string) =>
    onDetails === undefined ? (
      text
    ) : (
      <span
        role="button"
        className="convention-more"
        title="Pokaż otwarcia"
        // Its own click: the row around it would otherwise take it for choosing the convention.
        onClick={(event) => { event.stopPropagation(); onDetails(); }}
      >
        {text}
      </span>
    );

  return (
    <span className={`convention-option${holding ? ' holding' : ''}`} {...(canExplain ? handlers : {})}>
      {choice.label}
      <span className={`convention-place${place.kind === 'unreachable' ? ' unreachable' : ''}`}>
        {' · '}
        {place.kind === 'single' ? (
          <>
            <BidCard bid={cardOf(place.opening)} />
            {` · ${place.opening.meaning}${place.defence ? ' · także w obronie' : ''}`}
          </>
        ) : null}
        {place.kind === 'variants' ? (
          <>
            <BidCard bid={cardOf(place.opening)} />
            {' · '}
            {more(place.text)}
            {place.defence ? ' i obrona' : ''}
          </>
        ) : null}
        {place.kind === 'several' ? (
          <>
            {more(place.text)}
            {place.defence ? ' i obrona' : ''}
          </>
        ) : null}
        {place.kind === 'defence' || place.kind === 'unreachable' ? placeText(place) : null}
      </span>
    </span>
  );
}

/** Every opening the convention comes up after, each with its meaning - what a count in the list stands for. */
function ConventionOpenings({ choice, onClose }: { choice: ConventionChoice; onClose: () => void }) {
  return (
    <Dialog
      title={choice.label}
      onClose={onClose}
      // Opened from the list, which stays open beneath it: a click beside the window closes the window only.
      overlay
      actions={<Button size="small" icon={CloseIcon} onClick={onClose}>Zamknij</Button>}
    >
      <p className="ui-dialog-text">Konwencja pojawia się w licytacji po tych otwarciach:</p>
      <ul className="convention-openings">
        {choice.openings.map((opening) => (
          <li key={opening.nodeId}>
            <BidCard bid={cardOf(opening)} />
            {` · ${opening.meaning}`}
          </li>
        ))}
        {choice.defence ? <li>oraz w obronie, po otwarciu przeciwników</li> : null}
      </ul>
    </Dialog>
  );
}

/** The words an option is announced and titled by - the drawn version above says the same. */
function placeText(place: ConventionPlace): string {
  switch (place.kind) {
    case 'single':
      return `${place.opening.label} · ${place.opening.meaning}${place.defence ? ' · także w obronie' : ''}`;
    case 'variants':
      return `${place.opening.label} · ${place.text}${place.defence ? ' i obrona' : ''}`;
    case 'several':
      return `${place.text}${place.defence ? ' i obrona' : ''}`;
    case 'defence':
      return 'w obronie';
    case 'unreachable':
      return 'nieosiągalna - żadna gałąź systemu do niej nie prowadzi';
  }
}

function cardOf(opening: OpeningChoice) {
  return { type: opening.type, color: opening.color, value: opening.level };
}
