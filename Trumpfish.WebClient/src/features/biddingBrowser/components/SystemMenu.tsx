import { useState } from 'react';
import type { BiddingSystemSummary } from '@/api/models';
import { CheckIcon, LayersIcon } from '@/components/icons';
import { Popover } from '@/components/Popover';
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

  return (
    <Popover label={label} icon={<LayersIcon />} scrollBody={false}>
      <div className="popover-section">
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

      <div className="popover-section">
        {/* Enter submits, because the field and the button beside it are one gesture rather than two. */}
        <label className="popover-field">
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
          <button type="button" onClick={create} disabled={props.busy || name.trim() === ''}>
            Utwórz
          </button>
        </div>
      </div>

      <div className="popover-section">
        <div className="system-commands">
          <button type="button" onClick={props.onValidate} disabled={props.busy}>
            <CheckIcon />
            <span>Sprawdź</span>
          </button>

          <button type="button" onClick={props.onExport}>Eksportuj JSON</button>

          {/* A file input cannot be driven from a button without a hidden control and a ref, so it stays a label. */}
          <label className="system-import">
            Importuj JSON
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  props.onImport(file);
                }

                // Cleared so that importing the same file twice in a row still fires a change.
                event.target.value = '';
              }}
            />
          </label>
        </div>
      </div>
    </Popover>
  );
}
