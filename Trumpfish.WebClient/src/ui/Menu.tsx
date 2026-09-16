import type { ComponentType, ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Popup } from './Popup';
import type { ControlSize } from './Button';
import type { PanelAlign } from './Panel';
import './controls.css';
import './panel.css';

export interface MenuAction {
  label: string;
  /** Wymagana: wiersz menu jest komendą, a każda komenda w tej aplikacji to znak i słowo. */
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  /** Wyjście z aplikacji - jedyna pozycja, która nie jest miejscem, więc jest odsunięta i barwiona. */
  leave?: boolean;
}

/** Nazwany przycisk, który otwiera krótką listę komend. */
export function MenuPopup({ label, icon, actions, size = 'normal', align = 'start', disabled = false, triggerClassName }: {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  actions: MenuAction[];
  size?: ControlSize;
  align?: PanelAlign;
  disabled?: boolean;
  triggerClassName?: string;
}) {
  return (
    <Popup label={label} icon={icon} size={size} align={align} disabled={disabled} triggerClassName={triggerClassName}>
      {(close) =>
        actions.map((action) => (
          <MenuRow
            key={action.label}
            icon={action.icon}
            disabled={action.disabled}
            title={action.title}
            leave={action.leave}
            onClick={() => {
              close();
              action.onClick();
            }}
          >
            {action.label}
          </MenuRow>
        ))
      }
    </Popup>
  );
}

/** Jeden wiersz listy: znak, słowo i ta sama wysokość wszędzie. Wyrównanie do lewej pochodzi z `.ui-row`. */
export function MenuRow({ icon: Glyph, onClick, disabled = false, title, leave = false, size, children }: {
  icon?: ComponentType<{ className?: string }>;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  leave?: boolean;
  size?: ControlSize;
  children: ReactNode;
}) {
  const classes = ['ui-row', size === undefined || size === 'normal' ? '' : size, leave ? 'leave' : ''];

  return (
    <button type="button" className={classes.filter((name) => name !== '').join(' ')} disabled={disabled} title={title} onClick={onClick}>
      {Glyph === undefined ? null : <Glyph />}
      <span className="ui-row-grow">{children}</span>
    </button>
  );
}

/** Wiersz, który jest miejscem, a nie komendą: ten sam wygląd, tylko że linkiem. */
export function NavRow({ to, icon: Glyph, onClick, size, children }: {
  to: string;
  icon?: ComponentType<{ className?: string }>;
  onClick?: () => void;
  size?: ControlSize;
  children: ReactNode;
}) {
  const classes = ['ui-row', size === undefined || size === 'normal' ? '' : size];

  return (
    <NavLink to={to} end className={classes.filter((name) => name !== '').join(' ')} onClick={onClick}>
      {Glyph === undefined ? null : <Glyph />}
      <span className="ui-row-grow">{children}</span>
    </NavLink>
  );
}
