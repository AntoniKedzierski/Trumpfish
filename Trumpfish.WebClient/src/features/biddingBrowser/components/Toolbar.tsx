import { Select } from '@/components/Select';
import type { BiddingSystemSummary } from '@/api/models';

interface ToolbarProps {
  systemName: string;
  savedSystems: BiddingSystemSummary[];
  busy: boolean;
  dirty: boolean;
  canEditNode: boolean;
  onSystemNameChange: (name: string) => void;
  onAdd: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onSort: () => void;
  onRemoveUnreachable: () => void;
  onValidate: () => void;
  onSave: () => void;
  /** Systems are addressed by id: a fork may carry the same name as the seed it came from. */
  onLoad: (id: string) => void;
  onNew: () => void;
  onImport: (file: File) => void;
  onExport: () => void;
}

export function Toolbar(props: ToolbarProps) {
  const { systemName, savedSystems, busy, dirty, canEditNode } = props;

  return (
    <div className="toolbar">
      <button type="button" onClick={props.onAdd}>Dodaj</button>
      <button type="button" onClick={props.onDelete} disabled={!canEditNode}>Usuń</button>
      <button type="button" onClick={props.onMoveUp} disabled={!canEditNode}>▲</button>
      <button type="button" onClick={props.onMoveDown} disabled={!canEditNode}>▼</button>
      <button type="button" onClick={props.onSort}>Sortuj</button>
      <button type="button" onClick={props.onRemoveUnreachable} title="Usuwa z zaznaczonej gałęzi odzywki, których punkty lub długości kolorów wykluczają się z tym, co ten gracz już obiecał. Bez zaznaczenia czyści cały system.">
        Wyczyść nieosiągalne
      </button>
      <button type="button" onClick={props.onValidate} disabled={busy}>Sprawdź</button>

      <span className="separator" />

      <label className="inline">
        System:
        <input value={systemName} onChange={(event) => props.onSystemNameChange(event.target.value)} />
      </label>
      <button type="button" onClick={props.onNew}>Nowy</button>
      <button type="button" onClick={props.onSave} disabled={busy}>Zapisz{dirty ? ' *' : ''}</button>

      <Select
        className="load-select"
        value=""
        placeholder="Wczytaj z serwera…"
        disabled={busy}
        options={savedSystems.map((system) => ({ value: system.id, label: `${system.name} (${system.bidCount})` }))}
        onChange={(id) => props.onLoad(id)}
      />

      <span className="separator" />

      <label className="inline file">
        Importuj JSON
        <input type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) { props.onImport(file); } event.target.value = ''; }} />
      </label>
      <button type="button" onClick={props.onExport}>Eksportuj JSON</button>
    </div>
  );
}
