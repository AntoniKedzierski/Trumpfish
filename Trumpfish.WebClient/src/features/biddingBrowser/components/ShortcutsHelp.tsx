import { KeyIcon } from '@/components/icons';
import { Popup } from '@/ui';
import { shortcutGroups } from '../shortcuts';
import './ShortcutsHelp.css';

/**
 * Klawiatura, spisana.
 */
/*
 * Przeglądarka jest narzędziem klawiaturowym - komendy, które się liczą, są akordami, a te na pasku to te nieliczne,
 * które mają też przycisk. Nie było gdzie ich przeczytać, więc uczyło się ich od kogoś, kto już je znał.
 *
 * Panel, a nie dymek: to tabela do przeczytania, a nie zdanie do rzucenia okiem, i zostaje otwarty, kiedy czytający
 * patrzy na drzewko.
 */
export function ShortcutsHelp() {
  return (
    <Popup label="Skróty klawiszowe" icon={KeyIcon} hideLabel align="end" triggerClassName="shortcuts-trigger" panelClassName="shortcuts-panel">
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
    </Popup>
  );
}
