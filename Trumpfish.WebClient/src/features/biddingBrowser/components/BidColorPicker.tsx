import { ComboBox } from '@/ui';
import { SuitMark } from '@/components/suits';
import { bidColors, type BidColor } from '@/api/models';
import { bidColorLabels, suitClassName } from '../model';

interface BidColorPickerProps {
  /** Pusty wybór to `null` albo `NoColor` - lista pokazuje wtedy myślnik. */
  value: BidColor | null | undefined;
  onChange: (color: BidColor) => void;
  title?: string;
}

/**
 * Lista kolorów odzywki - jedna dla wszystkich pól, które pytają o kolor.
 */
/*
 * Kolor nazwany znakiem i słowem, w tej kolejności - znak jest tym, czego oko szuka na liście, a słowo tym, co czyta
 * czytnik ekranu i dymek. Znak rysuje `SuitMark`, jak wszędzie indziej w aplikacji; stoi w zwykłym tekście wewnątrz
 * `.bid-call`, bo w kontenerze flex przestałby słuchać linii pisma (DESIGN.md, rozdział 10).
 */
export function BidColorPicker({ value, onChange, title }: BidColorPickerProps) {
  return (
    <ComboBox
      value={value ?? 'NoColor'}
      title={title}
      options={bidColors.map((color) => ({
        value: color,
        label: bidColorLabels[color],
        labelClassName: suitClassName({ type: 'Submit', color }),
        labelNode: color === 'NoColor' ? undefined : (
          <span className="bid-call">
            <SuitMark suit={color} />
            <span className="bid-color-name">{bidColorLabels[color]}</span>
          </span>
        ),
      }))}
      onChange={onChange}
    />
  );
}
