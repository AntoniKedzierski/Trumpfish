import type { BiddingSystemSummary } from '@/api/models';
import { MenuButton } from '@/components/MenuButton';
import { Select } from '@/components/Select';

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
      {/*
       * What is used on every other click stays out in the open; everything else is named by the group it belongs to. The
       * bar used to be a dozen equally loud buttons, which on a narrow window wrapped into three rows of them.
       */}
      <button type="button" onClick={props.onAdd}>Dodaj</button>
      <button type="button" onClick={props.onDelete} disabled={!canEditNode}>Usuń</button>

      <MenuButton
        label="Gałąź"
        actions={[
          { label: 'Przenieś w górę', onClick: props.onMoveUp, disabled: !canEditNode },
          { label: 'Przenieś w dół', onClick: props.onMoveDown, disabled: !canEditNode },
          { label: 'Sortuj', onClick: props.onSort },
          {
            label: 'Wyczyść nieosiągalne',
            onClick: props.onRemoveUnreachable,
            title: 'W zaznaczonej gałęzi: usuwa odzywki, których punkty lub długości kolorów wykluczają się z tym, co ten gracz już obiecał, oraz czyści górne limity leżące powyżej obiecanych. Dolnych limitów nie rusza. Bez zaznaczenia czyści cały system.',
          },
        ]}
      />

      <button type="button" onClick={props.onValidate} disabled={busy}>Sprawdź</button>

      <span className="separator" />

      <label className="inline">
        System:
        <input value={systemName} onChange={(event) => props.onSystemNameChange(event.target.value)} />
      </label>

      <button type="button" className="primary" onClick={props.onSave} disabled={busy}>Zapisz{dirty ? ' *' : ''}</button>

      <Select
        className="load-select"
        value=""
        placeholder="Wczytaj…"
        disabled={busy}
        options={savedSystems.map((system) => ({ value: system.id, label: `${system.name} (${system.bidCount})` }))}
        onChange={(id) => props.onLoad(id)}
      />

      <MenuButton
        label="Plik"
        actions={[
          { label: 'Nowy system', onClick: props.onNew },
          { label: 'Eksportuj JSON', onClick: props.onExport },
        ]}
      />

      {/* A file input cannot be driven from a menu entry without a hidden control and a ref, so it stays its own button. */}
      <label className="inline file">
        Importuj
        <input type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) { props.onImport(file); } event.target.value = ''; }} />
      </label>
    </div>
  );
}
