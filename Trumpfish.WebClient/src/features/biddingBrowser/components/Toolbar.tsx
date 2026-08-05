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
  onValidate: () => void;
  onSave: () => void;
  onLoad: (name: string) => void;
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
      <button type="button" onClick={props.onValidate} disabled={busy}>Sprawdź</button>

      <span className="separator" />

      <label className="inline">
        System:
        <input value={systemName} onChange={(event) => props.onSystemNameChange(event.target.value)} />
      </label>
      <button type="button" onClick={props.onNew}>Nowy</button>
      <button type="button" onClick={props.onSave} disabled={busy}>Zapisz{dirty ? ' *' : ''}</button>

      <select value="" onChange={(event) => event.target.value !== '' && props.onLoad(event.target.value)} disabled={busy}>
        <option value="">Wczytaj z serwera…</option>
        {savedSystems.map((system) => (
          <option key={system.name} value={system.name}>{system.name} ({system.bidCount})</option>
        ))}
      </select>

      <span className="separator" />

      <label className="inline file">
        Importuj JSON
        <input type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) { props.onImport(file); } event.target.value = ''; }} />
      </label>
      <button type="button" onClick={props.onExport}>Eksportuj JSON</button>
    </div>
  );
}
