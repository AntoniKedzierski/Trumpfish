import { useRef, useState } from 'react';
import type { BiddingSystemSummary } from '@/api/models';
import { CheckIcon, DownloadIcon, LayersIcon, PlusIcon, UploadIcon } from '@/components/icons';
import { Popup } from '@/ui';
import { toolbarKeep } from '@/components/ToolBar';
import { SystemPicker } from '@/components/SystemPicker';
import './SystemMenu.css';

interface SystemMenuProps {
  /** The system being edited. Read only: a system is named when it is created and keeps that name. */
  systemName: string;
  /** Null for a system that has never been stored - a new one, or one just imported. */
  systemId: string | null;
  savedSystems: BiddingSystemSummary[];
  busy: boolean;
  onLoad: (id: string) => void;
  onCreate: (name: string) => void;
  onValidate: () => void;
  onImport: (file: File) => void;
  onExport: () => void;
}

/**
 * Everything that is done to a system rather than to a bid: opening one, starting one, checking it, and moving it in and
 * out of a file.
 */
/*
 * All of it used to stand on the bar, where a dozen equally loud controls wrapped into three rows on a narrow window. None
 * of it is used while editing - opening a system happens once a sitting - so it is named once here and read only when
 * somebody comes looking.
 *
 * The name is shown and not offered for editing. Renaming a loaded system is not a thing anybody means to do: the field
 * that allowed it sat on the bar with the caret in it, one keystroke away from silently forking the system under a new
 * name on the next save. A new system is named where naming it is the point - as it is created.
 */
export function SystemMenu(props: SystemMenuProps) {
  const [name, setName] = useState('');
  const file = useRef<HTMLInputElement>(null);

  const create = () => {
    const trimmed = name.trim();
    if (trimmed === '') {
      return;
    }

    props.onCreate(trimmed);
    setName('');
  };

  // The trigger names what is open. Until something has been opened there is no name to give, and it says what it is instead.
  const label = props.systemId === null ? 'System' : props.systemName;

  // Nazwa otwartego systemu zostaje na pasku na każdej szerokości: sam znak nie powie, co się właśnie edytuje.
  return (
    <Popup label={label} icon={LayersIcon} scroll={false} className={toolbarKeep}>
      <div className="ui-panel-section">
        <p className="system-current">
          <span>Edytujesz</span>
          <strong title={props.systemName}>{props.systemName}</strong>
        </p>

        <SystemPicker
          systems={props.savedSystems}
          systemId={props.systemId ?? ''}
          onSystemId={props.onLoad}
          disabled={props.busy}
          placeholder="Wczytaj system…"
          note={(system) => `${system.bidCount ?? 0}`}
        />
      </div>

      <div className="ui-panel-section">
        {/* Enter submits, because the field and the button beside it are one gesture rather than two. */}
        <label className="ui-field">
          <span>Nowy system</span>
          <input
            type="text"
            value={name}
            placeholder="Nazwa"
            disabled={props.busy}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                create();
              }
            }}
          />
        </label>

        <div className="system-commands">
          <button type="button" className="small" onClick={create} disabled={props.busy || name.trim() === ''}>
            <PlusIcon />
            <span>Utwórz</span>
          </button>
        </div>
      </div>

      <div className="ui-panel-section">
        {/* Three commands of one size, in one row. A label wearing a button's clothes was the odd one out of the three. */}
        <div className="system-commands">
          <button type="button" className="small" onClick={props.onValidate} disabled={props.busy}>
            <CheckIcon />
            <span>Sprawdź</span>
          </button>

          <button type="button" className="small" onClick={props.onExport}>
            <DownloadIcon />
            <span>Eksportuj JSON</span>
          </button>

          <button type="button" className="small" onClick={() => file.current?.click()}>
            <UploadIcon />
            <span>Importuj JSON</span>
          </button>

          {/* The control that actually opens the file dialog. Out of the way but in the accessibility tree, so it keeps its name. */}
          <input
            ref={file}
            type="file"
            className="sr-only"
            accept="application/json,.json"
            aria-label="Wybierz plik JSON do importu"
            onChange={(event) => {
              const chosen = event.target.files?.[0];
              if (chosen) {
                props.onImport(chosen);
              }

              // Cleared so that importing the same file twice in a row still fires a change.
              event.target.value = '';
            }}
          />
        </div>
      </div>
    </Popup>
  );
}
