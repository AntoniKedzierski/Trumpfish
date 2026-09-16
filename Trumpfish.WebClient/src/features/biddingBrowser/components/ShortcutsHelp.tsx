import { HelpIcon } from '@/components/icons';
import { useMediaQuery } from '@/components/useMediaQuery';
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
 * W układzie mobilnym nie ma jej wcale: spis skrótów klawiszowych na ekranie bez klawiatury to przycisk, który zabiera
 * miejsce w pasku i nie prowadzi do niczego, co dałoby się zrobić.
 */
export function ShortcutsHelp() {
  const narrow = useMediaQuery('(max-width: 720px)');

  if (narrow) {
    return null;
  }

  return (
    <Popup label="Skróty klawiszowe" icon={HelpIcon} hideLabel align="end" triggerClassName="shortcuts-trigger" panelClassName="shortcuts-panel">
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
