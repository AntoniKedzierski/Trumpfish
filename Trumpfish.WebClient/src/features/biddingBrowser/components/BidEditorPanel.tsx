import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Chevron, ComboBox } from '@/ui';
import { useMediaQuery } from '@/components/useMediaQuery';
import { bidTypes, toNumber, type BidType, type NumberRange } from '@/api/models';
import { conflicts, placeholderFor, type InheritedRanges, type RangeField } from '../constraints';
import { bidTypeLabels, type EditableBidNode, type EditableSystem, type NodePath } from '../model';
import { readCondition } from '../conditionReader';
import { BidColorPicker } from './BidColorPicker';
import { BidPath } from './BidPath';
import { FigureMatrix } from './FigureMatrix';
import { ContinuationPicker } from './ContinuationPicker';
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
  /** Cały system: przejście wskazuje w dowolne jego miejsce, więc wybierak musi widzieć całe drzewo. */
  system: EditableSystem;
  /** Zaznacza wskazaną odzywkę w drzewie i przewija do niej - tym chodzi się za przejściem. */
  onGoTo: (target: NodePath) => void;
  onChange: (patch: Partial<EditableBidNode>) => void;
}

/**
 * Pięć zakresów jako jedna tabela: kolumna na zakres, wiersz na granicę.
 */
/*
 * Tak samo na każdej szerokości. Pięć nazwanych par pól pod sobą zajmowało pięć etykiet i dziesięć pudełek w pionie, a
 * granice - które porównuje się między sobą - nigdy nie stały w jednej linii. Obrócony układ powstał dla telefonu i
 * okazał się po prostu lepszy, więc tamten drugi zniknął zamiast czekać na swoją szerokość.
 */
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
  { field: 'tryPremiumContract', label: 'Aspiracje szlemikowe' },
  { field: 'goToOpenings', label: 'Przejdź do otwarć' },
  { field: 'isPreferred', label: 'Odzywka preferowana' },
  { field: 'alert', label: 'Alert' },
  { field: 'isDisabled', label: 'Wyłączona z symulacji' },
];

const stopsFields: { field: StopsField; label: string }[] = [
  { field: 'clubsStops', label: 'Trefle' },
  { field: 'diamondsStops', label: 'Karo' },
  { field: 'heartsStops', label: 'Kiery' },
  { field: 'spadesStops', label: 'Piki' },
];

export function BidEditorPanel({ node, rootName, focusConditionKey, inherited, ancestors, system, onGoTo, onChange }: BidEditorPanelProps) {
  const conditionRef = useRef<HTMLInputElement>(null);

  // The same question the page asks to decide whether the editor is a pane or a sheet, asked again for what goes inside it.
  const narrow = useMediaQuery('(max-width: 900px)');

  /*
   * Eight switches are the longest run of rows in here and the least often touched. A pane with the room shows them; a
   * sheet held over the tree starts with them folded away, and either way they are one tap from being read.
   */
  const [optionsOpen, setOptionsOpen] = useState(true);

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
            <BidColorPicker value={node.color} onChange={(color) => onChange({ color })} />
          </label>

          <label className="field">
            <span>Wtrącenie</span>
            <InterjectionPicker value={node.interjection} ancestors={ancestors} onChange={(interjection) => onChange({ interjection })} />
          </label>

          <label className="field">
            <span>Typ</span>
            <ComboBox value={node.type ?? 'Submit'} options={bidTypes.map((type) => ({ value: type, label: bidTypeLabels[type] }))} onChange={changeType} />
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

        <div className="field-grid even">
          <label className="field">
            <span>Konwencja</span>
            <input
              value={node.convention ?? ''}
              title="Puste = naturalna. 'Sztuczne' = sztuczna bez konwencji. Nazwa z dużej litery."
              onChange={(event) => onChange({ convention: event.target.value })}
            />
          </label>

          <label className="field">
            <span>Indeks szlemowy</span>
            <input
              type="number"
              value={toNumber(node.slamConventionIndex) ?? ''}
              onChange={(event) => onChange({ slamConventionIndex: event.target.value === '' ? null : Number(event.target.value) })}
            />
          </label>
        </div>

        <label>Przejście</label>
        <ContinuationPicker
          system={system}
          node={node}
          pickable={!narrow}
          onChange={(continuationNodeId) => onChange({ continuationNodeId })}
          onGoTo={onGoTo}
        />

        {/* Dwa kolory, o które pyta się tą samą listą co o kolor odzywki; myślnik na liście czyści pole. */}
        <div className="field-grid even">
          <label className="field">
            <span>Kolor końcówki</span>
            <BidColorPicker value={node.outputGameColor} onChange={(color) => onChange({ outputGameColor: color === 'NoColor' ? null : color })} />
          </label>

          <label className="field">
            <span>Kolor wejściowy</span>
            <BidColorPicker value={node.inputBidColor} onChange={(color) => onChange({ inputBidColor: color === 'NoColor' ? null : color })} />
          </label>
        </div>

        <RangeMatrix node={node} inherited={inherited} onBound={changeRange} />

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
