import type { BiddingSystemSummary } from '@/api/models';
import { ArrowDownIcon, ArrowUpIcon, BranchIcon, BroomIcon, PlusIcon, SaveIcon, SortIcon, TrashIcon } from '@/components/icons';
import { MenuPopup } from '@/ui';
import { ToolBar, toolbarKeepLonger } from '@/components/ToolBar';
import { ShortcutsHelp } from './ShortcutsHelp';
import { SystemMenu } from './SystemMenu';

interface ToolbarProps {
  systemName: string;
  systemId: string | null;
  savedSystems: BiddingSystemSummary[];
  busy: boolean;
  dirty: boolean;
  canEditNode: boolean;
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
  onCreate: (name: string) => void;
  onImport: (file: File) => void;
  onExport: () => void;
  /** What the page is doing, read at the far end of the same bar. */
  status?: React.ReactNode;
}

/**
 * One row: what is pressed while editing, and one door to everything else.
 */
/*
 * Built the same way as the simulator's bar, because it is the same kind of thing. What is used on every other click
 * stays out in the open - add a bid, delete one, save - and everything that is done once a sitting is named by the group
 * it belongs to and folded away. The bar used to be a dozen equally loud controls that wrapped into three rows on a
 * narrow window, which is how a command you need becomes one you hunt for.
 */
export function Toolbar(props: ToolbarProps) {
  const { systemName, systemId, savedSystems, busy, dirty, canEditNode } = props;

  return (
    <ToolBar status={props.status}>
      <SystemMenu
        systemName={systemName}
        systemId={systemId}
        savedSystems={savedSystems}
        busy={busy}
        onLoad={props.onLoad}
        onCreate={props.onCreate}
        onValidate={props.onValidate}
        onImport={props.onImport}
        onExport={props.onExport}
      />

      <span className="toolbar-separator" />

      <button type="button" onClick={props.onAdd}>
        <PlusIcon />
        <span>Dodaj</span>
      </button>
      <button type="button" onClick={props.onDelete} disabled={!canEditNode}>
        <TrashIcon />
        <span>Usuń</span>
      </button>

      <MenuPopup
        label="Gałąź"
        icon={BranchIcon}
        actions={[
          { label: 'Przenieś w górę', icon: ArrowUpIcon, onClick: props.onMoveUp, disabled: !canEditNode },
          { label: 'Przenieś w dół', icon: ArrowDownIcon, onClick: props.onMoveDown, disabled: !canEditNode },
          { label: 'Sortuj', icon: SortIcon, onClick: props.onSort },
          {
            label: 'Wyczyść nieosiągalne',
            icon: BroomIcon,
            onClick: props.onRemoveUnreachable,
            title: 'W zaznaczonej gałęzi: usuwa odzywki, których punkty lub długości kolorów wykluczają się z tym, co ten gracz już obiecał, oraz czyści górne limity leżące powyżej obiecanych. Dolnych limitów nie rusza. Bez zaznaczenia czyści cały system.',
          },
        ]}
      />

      {/* The one command that writes to the server is the one that looks like it does - and the last to give up its word. */}
      <button type="button" className={`primary ${toolbarKeepLonger}`} onClick={props.onSave} disabled={busy}>
        <SaveIcon />
        <span>Zapisz{dirty ? ' *' : ''}</span>
      </button>

      <ShortcutsHelp />
    </ToolBar>
  );
}
