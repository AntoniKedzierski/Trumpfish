import { useId } from 'react';
import { useDisclosure } from '@/components/useDisclosure';
import { shortcutGroups } from '../shortcuts';
import './ShortcutsHelp.css';

/**
 * The keyboard, written down.
 */
/*
 * The browser is a keyboard tool - the commands that matter are chords, and the ones on the bar are the few that also have
 * a button. There was nowhere to read them, so they were learnt from whoever already knew them.
 *
 * A disclosure rather than a tooltip: it is a table to read, not a sentence to glance at, and it stays open while the
 * reader looks away at the tree.
 */
export function ShortcutsHelp() {
  const { open, setOpen, root, trigger } = useDisclosure<HTMLDivElement>();
  const panelId = useId();

  return (
    <div className="shortcuts" ref={root}>
      <button
        type="button"
        ref={trigger}
        className="shortcuts-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Skróty klawiszowe"
        title="Skróty klawiszowe"
        onClick={() => setOpen((was) => !was)}
      >
        ?
      </button>

      {!open ? null : (
        <div className="shortcuts-panel" id={panelId}>
          {shortcutGroups.map((group) => (
            <section key={group.title}>
              <h4>{group.title}</h4>
              <dl>
                {group.shortcuts.map((shortcut) => (
                  <div key={shortcut.keys}>
                    <dt>
                      <kbd>{shortcut.keys}</kbd>
                    </dt>
                    <dd>{shortcut.what}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
