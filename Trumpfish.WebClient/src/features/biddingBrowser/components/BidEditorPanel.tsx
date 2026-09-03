import { Select } from '@/components/Select';
import { bidColors, bidTypes, toNumber, type NumberRange } from '@/api/models';
import { conflicts, placeholderFor, type InheritedRanges, type RangeField } from '../constraints';
import { bidColorLabels, bidTypeLabels, suitClassName, type EditableBidNode } from '../model';
import { BidPath } from './BidPath';
import { InterjectionPicker } from './InterjectionPicker';

type StopsField = 'clubsStops' | 'diamondsStops' | 'heartsStops' | 'spadesStops';

interface BidEditorPanelProps {
  node: EditableBidNode | null;
  /** Name of the root the edited bid lives under; the outermost level of the path shown above the fields. */
  rootName: string | null;
  /** Ranges promised by the same player earlier in the sequence - shown as placeholders only, never written back to the node. */
  inherited: InheritedRanges;
  /** Bids said before the edited one, from the root down to its parent - they decide which interjections are legal. */
  ancestors: readonly EditableBidNode[];
  onChange: (patch: Partial<EditableBidNode>) => void;
}

const rangeFields: { field: RangeField; label: string }[] = [
  { field: 'pointsRange', label: 'Zakres punktów' },
  { field: 'clubsCardRange', label: 'Układ trefli' },
  { field: 'diamondsCardRange', label: 'Układ kar' },
  { field: 'heartsCardRange', label: 'Układ kierów' },
  { field: 'spadesCardRange', label: 'Układ pików' },
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

export function BidEditorPanel({ node, rootName, inherited, ancestors, onChange }: BidEditorPanelProps) {
  if (node === null) {
    return (
      <aside className="editor-pane">
        <div className="editor empty">Wybierz odzywkę, aby edytować jej szczegóły.</div>
      </aside>
    );
  }

  const changeRange = (field: RangeField, bound: keyof NumberRange, raw: string) => {
    const current = (node[field] ?? {}) as NumberRange;
    onChange({ [field]: { ...current, [bound]: raw === '' ? null : Number(raw) } } as Partial<EditableBidNode>);
  };

  return (
    <aside className="editor-pane">
      <BidPath rootName={rootName} ancestors={ancestors} />

      <div className="editor">
        <label>Wartość</label>
        <input type="number" min={1} max={7} value={toNumber(node.value) ?? ''} onChange={(event) => onChange({ value: event.target.value === '' ? null : Number(event.target.value) })} />

        <label>Kolor</label>
        <Select
          value={node.color ?? 'NoColor'}
          options={bidColors.map((color) => ({ value: color, label: bidColorLabels[color], labelClassName: suitClassName({ type: 'Submit', color }) }))}
          onChange={(color) => onChange({ color })}
        />

        <label>Typ</label>
        <Select value={node.type ?? 'Submit'} options={bidTypes.map((type) => ({ value: type, label: bidTypeLabels[type] }))} onChange={(type) => onChange({ type })} />

        <label>Wtrącenie</label>
        <InterjectionPicker value={node.interjection} ancestors={ancestors} onChange={(interjection) => onChange({ interjection })} />

        <label>Znaczenie</label>
        <input value={node.condition ?? ''} onChange={(event) => onChange({ condition: event.target.value })} />

        <label>Dodatkowy opis</label>
        <input value={node.description ?? ''} onChange={(event) => onChange({ description: event.target.value })} />

        <label>Konwencja</label>
        <input
          value={node.convention ?? ''}
          title="Puste = naturalna. 'Sztuczne' = sztuczna bez konwencji. Nazwa z dużej litery."
          onChange={(event) => onChange({ convention: event.target.value })}
        />

        {flagFields.map(({ field, label }) => (
          <label key={field} className="checkbox">
            <input type="checkbox" checked={Boolean(node[field])} onChange={(event) => onChange({ [field]: event.target.checked } as Partial<EditableBidNode>)} />
            {label}
          </label>
        ))}

        {rangeFields.map(({ field, label }) => {
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
        })}

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
      </div>
    </aside>
  );
}
