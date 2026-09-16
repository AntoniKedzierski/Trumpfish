import type { BiddingSystemSummary } from '@/api/models';
import { ComboBox } from '@/ui';
import './SystemPicker.css';

interface SystemPickerProps {
  systems: readonly BiddingSystemSummary[];
  /** System w użyciu, albo pusty ciąg, kiedy nie wybrano żadnego. */
  systemId: string;
  onSystemId: (id: string) => void;
  disabled?: boolean;
  /** Stoi w wierszu, dopóki system nie zostanie wybrany. */
  placeholder?: string;
  /** Słowo o systemie, dopisywane za jego nazwą na liście. */
  note?: (system: BiddingSystemSummary) => string | undefined;
}

/**
 * System w użyciu i lista do jego zmiany.
 */
/*
 * To zwykła lista wyboru i nic ponadto - była osobną kontrolką z własnym wierszem, własnym panelem i własną skalą pisma
 * (14 px etykiety przy 12 px przyciskach w tym samym popupie), co było pierwszym z naruszeń, które użytkownik wypisał.
 * Wspólna dla symulatora i przeglądarki, bo zadają to samo pytanie o tę samą listę.
 */
export function SystemPicker({ systems, systemId, onSystemId, disabled = false, placeholder = 'System', note }: SystemPickerProps) {
  const options = systems.map((system) => ({
    value: system.id,
    label: system.name,
    labelNode:
      note?.(system) === undefined ? undefined : (
        <>
          {system.name}
          <span className="picker-note">{note(system)}</span>
        </>
      ),
  }));

  return (
    <ComboBox
      value={systemId}
      options={options}
      onChange={onSystemId}
      disabled={disabled || systems.length === 0}
      placeholder={systems.length === 0 ? 'Brak zapisanych systemów' : placeholder}
    />
  );
}
