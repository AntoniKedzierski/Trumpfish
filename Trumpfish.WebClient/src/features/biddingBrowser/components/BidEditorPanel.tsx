import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Chevron, Select } from '@/components/Select';
import { useMediaQuery } from '@/components/useMediaQuery';
import { bidColors, bidTypes, toNumber, type BidType, type NumberRange } from '@/api/models';
import { conflicts, placeholderFor, type InheritedRanges, type RangeField } from '../constraints';
import { bidColorLabels, bidTypeLabels, suitClassName, type EditableBidNode } from '../model';
import { readCondition } from '../conditionReader';
import { BidPath } from './BidPath';
import { FigureMatrix } from './FigureMatrix';
import { InterjectionPicker } from './InterjectionPicker';

type StopsField = 'clubsStops' | 'diamondsStops' | 'heartsStops' | 'spadesStops';
type Bound = 'lower' | 'upper';

interface BidEditorPanelProps {
  node: EditableBidNode | null;
  /** Name of the root the edited bid lives under; the outermost level of the path shown above the fields. */
  rootName: string | null;
  /** Bumped whenever a bid was just added, which is the moment to put the caret in "Znaczenie". */
  focusConditionKey: number;
  /** Ranges promised by the same player earlier in the sequence - shown as placeholders only, never written back to the node. */
  inherited: InheritedRanges;
  /** Bids said before the edited one, from the root down to its parent - they decide which interjections are legal. */
  ancestors: readonly EditableBidNode[];
  onChange: (patch: Partial<EditableBidNode>) => void;
}

/** One range per row, each under its own name. What a wide pane has the room to say in full. */
const rangeFields: { field: RangeField; label: string }[] = [
  { field: 'pointsRange', label: 'Zakres punktów' },
  { field: 'clubsCardRange', label: 'Układ trefli' },
  { field: 'diamondsCardRange', label: 'Układ kar' },
  { field: 'heartsCardRange', label: 'Układ kierów' },
  { field: 'spadesCardRange', label: 'Układ pików' },
];

/** The same five turned on their side, for a screen with height to spare and no width. */
const rangeColumns: { field: RangeField; label: string }[] = [
  { field: 'pointsRange', label: 'Punkty' },
  { field: 'clubsCardRange', label: 'Trefle' },
  { field: 'diamondsCardRange', label: 'Karo' },
  { field: 'heartsCardRange', label: 'Kiery' },
  { field: 'spadesCardRange', label: 'Piki' },
];

const flagFields: { field: keyof EditableBidNode; label: string }[] = [
  { field: 'openerBid', label: 'Jako otwierający' },
  { field: 'signOff', label: 'Odzywka wyprzęgająca' },
  { field: 'automaticResponse', label: 'Odzywka automatyczna' },
  { field: 'oneRoundForcing', label: 'Forsująca na jedno kółko' },
  { field: 'gameForcing', label: 'Forsująca do końcówki' },
  { field: 'goToOpenings', label: 'Przejdź do otwarć' },
  { field: 'isPreferred', label: 'Odzywka preferowana' },
  { field: 'isDisabled', label: 'Wyłączona z symulacji' },
];

const stopsFields: { field: StopsField; label: string }[] = [
  { field: 'clubsStops', label: 'Trefle' },
  { field: 'diamondsStops', label: 'Karo' },
  { field: 'heartsStops', label: 'Kiery' },
  { field: 'spadesStops', label: 'Piki' },
];

export function BidEditorPanel({ node, rootName, focusConditionKey, inherited, ancestors, onChange }: BidEditorPanelProps) {
  const conditionRef = useRef<HTMLInputElement>(null);

  // The same question the page asks to decide whether the editor is a pane or a sheet, asked again for what goes inside it.
  const narrow = useMediaQuery('(max-width: 900px)');

  /*
   * Eight switches are the longest run of rows in here and the least often touched. A pane with the room shows them; a
   * sheet held over the tree starts with them folded away, and either way they are one tap from being read.
   */
  const [optionsOpen, setOptionsOpen] = useState(!narrow);

  // Runs on the render that follows the new bid, so the field it reaches for is the one belonging to that bid.
  useEffect(() => {
    if (focusConditionKey > 0) {
      conditionRef.current?.focus();
      conditionRef.current?.select();
    }
  }, [focusConditionKey]);

  if (node === null) {
    return (
      <aside className="editor-pane">
        <div className="editor empty">Wybierz odzywkę, aby edytować jej szczegóły.</div>
      </aside>
    );
  }

  const changeRange = (field: RangeField, bound: Bound, raw: string) => {
    const current = (node[field] ?? {}) as NumberRange;
    onChange({ [field]: { ...current, [bound]: raw === '' ? null : Number(raw) } } as Partial<EditableBidNode>);
  };

  /*
   * A pass, a double and a redouble are the whole call: there is no level to say them at and no suit to say them in. Both
   * fields used to keep whatever the bid was before, which is a contradiction the editor left for the user to notice.
   */
  const changeType = (type: BidType) => {
    onChange(type === 'Submit' ? { type } : { type, value: null, color: 'NoColor' });
  };

  // Shift+Enter fills the point range and the suit lengths in from the description, so they never have to be typed twice.
  const readFromCondition = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || !event.shiftKey) {
      return;
    }

    event.preventDefault();
    const patch = readCondition(node.condition ?? '', inherited);

    // Nothing recognised means nothing to write; an empty patch would only mark the system dirty for no reason.
    if (Object.keys(patch).length > 0) {
      onChange(patch);
    }
  };

  return (
    <aside className="editor-pane">
      <BidPath rootName={rootName} ancestors={ancestors} />

      <div className="editor">
        {/*
          * What the call is, in two rows of two. The narrow column takes the two controls that hold a call - a level and
          * an interjection - and the wide one the two that hold a word, which is what the 1:2 split is for.
          */}
        <div className="field-grid">
          <label className="field">
            <span>Wartość</span>
            <input type="number" min={1} max={7} value={toNumber(node.value) ?? ''} onChange={(event) => onChange({ value: event.target.value === '' ? null : Number(event.target.value) })} />
          </label>

          <label className="field">
            <span>Kolor</span>
            <Select
              value={node.color ?? 'NoColor'}
              options={bidColors.map((color) => ({ value: color, label: bidColorLabels[color], labelClassName: suitClassName({ type: 'Submit', color }) }))}
              onChange={(color) => onChange({ color })}
            />
          </label>

          <label className="field">
            <span>Wtrącenie</span>
            <InterjectionPicker value={node.interjection} ancestors={ancestors} onChange={(interjection) => onChange({ interjection })} />
          </label>

          <label className="field">
            <span>Typ</span>
            <Select value={node.type ?? 'Submit'} options={bidTypes.map((type) => ({ value: type, label: bidTypeLabels[type] }))} onChange={changeType} />
          </label>
        </div>

        <label>Znaczenie</label>
        <input
          ref={conditionRef}
          value={node.condition ?? ''}
          title="Shift+Enter odczytuje z treści punkty i długości kolorów."
          onChange={(event) => onChange({ condition: event.target.value })}
          onKeyDown={readFromCondition}
        />

        <label>Dodatkowy opis</label>
        <input value={node.description ?? ''} onChange={(event) => onChange({ description: event.target.value })} />

        <label>Konwencja</label>
        <input
          value={node.convention ?? ''}
          title="Puste = naturalna. 'Sztuczne' = sztuczna bez konwencji. Nazwa z dużej litery."
          onChange={(event) => onChange({ convention: event.target.value })}
        />

        <section className="editor-options">
          <button
            type="button"
            className="editor-options-trigger"
            aria-expanded={optionsOpen}
            aria-controls="editor-options-body"
            onClick={() => setOptionsOpen((was) => !was)}
          >
            <span>Opcje</span>
            <Chevron className="editor-options-chevron" />
          </button>

          {!optionsOpen ? null : (
            <div className="editor-options-body" id="editor-options-body">
              {flagFields.map(({ field, label }) => (
                <label key={field} className="checkbox">
                  <input type="checkbox" checked={Boolean(node[field])} onChange={(event) => onChange({ [field]: event.target.checked } as Partial<EditableBidNode>)} />
                  {label}
                </label>
              ))}
            </div>
          )}
        </section>

        {narrow ? (
          <RangeMatrix node={node} inherited={inherited} onBound={changeRange} />
        ) : (
          rangeFields.map(({ field, label }) => {
            const range = node[field] as NumberRange | null;
            const hint = inherited[field];

            return (
              <div key={field}>
                <label>{label}</label>
                <div className="pair">
                  <input
                    type="number"
                    className={conflicts(hint, range, 'lower') ? 'conflict' : undefined}
                    placeholder={placeholderFor(hint, 'lower')}
                    value={toNumber(range?.lower) ?? ''}
                    onChange={(event) => changeRange(field, 'lower', event.target.value)}
                  />
                  <input
                    type="number"
                    className={conflicts(hint, range, 'upper') ? 'conflict' : undefined}
                    placeholder={placeholderFor(hint, 'upper')}
                    value={toNumber(range?.upper) ?? ''}
                    onChange={(event) => changeRange(field, 'upper', event.target.value)}
                  />
                </div>
              </div>
            );
          })
        )}

        <label>Rozkład kolorów</label>
        <input value={node.colorDistribution ?? ''} onChange={(event) => onChange({ colorDistribution: event.target.value })} />

        <label className="section" title="As (1), drugi król (1), trzecia dama (1). Król singiel (0.5), druga dama (0.5).">Liczba zatrzymań</label>
        <div className="grid-4">
          {stopsFields.map(({ field, label }) => (
            <div key={field}>
              <span>{label}</span>
              <input type="number" step="0.5" value={toNumber(node[field]) ?? ''} onChange={(event) => onChange({ [field]: event.target.value === '' ? null : Number(event.target.value) } as Partial<EditableBidNode>)} />
            </div>
          ))}
        </div>

        <div className="grid-2">
          <div>
            <span>Asy</span>
            <input type="number" value={toNumber(node.aces) ?? ''} onChange={(event) => onChange({ aces: event.target.value === '' ? null : Number(event.target.value) })} />
          </div>
          <div>
            <span>Króle</span>
            <input type="number" value={toNumber(node.kings) ?? ''} onChange={(event) => onChange({ kings: event.target.value === '' ? null : Number(event.target.value) })} />
          </div>
        </div>

        <FigureMatrix value={node.figures} onChange={(figures) => onChange({ figures })} />
      </div>
    </aside>
  );
}

/**
 * The five ranges as one table: a column per range, a row per bound.
 */
/*
 * Five named rows of two fields each is five labels and ten boxes down a screen that has no width to lose them in. Turned
 * ninety degrees the names become one header row and the ten boxes two, which is the same reading in a fraction of the
 * height - and the bounds line up with each other, which they never did while each pair stood under its own name.
 */
function RangeMatrix({ node, inherited, onBound }: {
  node: EditableBidNode;
  inherited: InheritedRanges;
  onBound: (field: RangeField, bound: Bound, raw: string) => void;
}) {
  const bounds: { bound: Bound; label: string }[] = [
    { bound: 'lower', label: 'od' },
    { bound: 'upper', label: 'do' },
  ];

  return (
    <table className="range-matrix">
      <caption className="sr-only">Zakres punktów i długości kolorów: dolna i górna granica</caption>
      <thead>
        <tr>
          <th scope="col"><span className="sr-only">Granica</span></th>
          {rangeColumns.map(({ field, label }) => (
            <th key={field} scope="col">{label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {bounds.map(({ bound, label }) => (
          <tr key={bound}>
            <th scope="row">{label}</th>
            {rangeColumns.map(({ field }) => {
              const range = node[field] as NumberRange | null;
              const hint = inherited[field];

              return (
                <td key={field}>
                  <input
                    type="number"
                    className={conflicts(hint, range, bound) ? 'conflict' : undefined}
                    placeholder={placeholderFor(hint, bound)}
                    value={toNumber(range?.[bound]) ?? ''}
                    onChange={(event) => onBound(field, bound, event.target.value)}
                  />
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
