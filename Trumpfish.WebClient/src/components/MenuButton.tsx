import type { ComponentType } from 'react';
import { useId } from 'react';
import { Chevron } from './Select';
import { useDisclosure } from './useDisclosure';
import './menu.css';
import './MenuButton.css';

export interface MenuAction {
  label: string;
  /** Required: a row of a dropdown is a command, and every command in this application is a mark and a word. */
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}

/**
 * A named button that opens a short list of commands.
 */
/*
 * The toolbars had grown to a row of a dozen equally loud buttons, which on a narrow window wrapped into three rows of
 * them. Commands that belong together are named once here and read only when the user goes looking for them.
 *
 * A disclosure rather than a menu, like every other dropdown in this application: the entries are plain buttons, so Tab
 * walks them and no arrow-key contract is promised that they would not honour.
 */
export function MenuButton({ label, icon: Glyph, actions, disabled = false }: {
  label: string;
  /** Drawn on the trigger, the way the other bar controls that open something are drawn. */
  icon?: ComponentType<{ className?: string }>;
  actions: MenuAction[];
  disabled?: boolean;
}) {
  const { open, setOpen, root, trigger } = useDisclosure<HTMLDivElement>();
  const panelId = useId();

  return (
    <div className="menu-button" ref={root}>
      <button
        type="button"
        ref={trigger}
        className="menu-button-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        disabled={disabled}
        onClick={() => setOpen((was) => !was)}
      >
        {Glyph === undefined ? null : <Glyph />}
        <span>{label}</span>
        <Chevron className="menu-button-chevron" />
      </button>

      {!open ? null : (
        <div className="menu-panel menu-button-panel" id={panelId}>
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              disabled={action.disabled ?? false}
              title={action.title}
              onClick={() => {
                setOpen(false);
                action.onClick();
              }}
            >
              <action.icon />
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
