import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Chevron } from './ComboBox';
import { Panel } from './Panel';
import type { PanelAlign } from './Panel';
import type { ControlSize } from './Button';
import './panel.css';

interface PopupProps {
  /** Słowo na wyzwalaczu. Zostaje w drzewie dostępności także wtedy, gdy pasek chowa słowa. */
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  size?: ControlSize;
  /** Dokładany do wyzwalacza tam, gdzie widok maluje go po swojemu - wyłącznie kolorem i obramowaniem. */
  triggerClassName?: string;
  /** Liczniki i znaczniki za słowem: ilu znajomych jest dostępnych, ile filtrów działa. */
  badges?: React.ReactNode;
  /** Sam znak na wyzwalaczu: słowo zostaje dla czytnika ekranu, strzałka znika, bo nie ma przy czym stać. */
  hideLabel?: boolean;
  /** Ile ograniczeń działa - zwinięty filtr łatwo przeoczyć, więc wyzwalacz nosi ich liczbę. */
  count?: number;
  align?: PanelAlign;
  scroll?: boolean;
  inline?: boolean;
  footer?: React.ReactNode;
  /** Dokładane do panelu tam, gdzie jego treść potrzebuje własnej szerokości albo układu. */
  panelClassName?: string;
  disabled?: boolean;
  /** Wywoływane przy każdym zamknięciu - to na tym wiesza się "kliknięcie obok znaczy zatwierdź". */
  onClose?: () => void;
  /** Treść panelu; dostaje sposób na zamknięcie go, bo wybranie czegoś zwykle znaczy koniec. */
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
}

/**
 * Wyzwalacz i panel pod nim - jedyny sposób, w jaki w tej aplikacji coś się otwiera.
 */
/*
 * Ujawnienie, a nie menu ARIA: w panelu stoją zwykłe linki i przyciski, więc Tab chodzi po nich w kolejności rysowania i
 * nikt nie obiecuje strzałek, których te kontrolki i tak by nie obsłużyły.
 */
export function Popup({
  label,
  icon: Glyph,
  size = 'normal',
  triggerClassName = '',
  badges,
  count,
  hideLabel = false,
  align = 'start',
  scroll = true,
  inline = false,
  footer,
  panelClassName,
  disabled = false,
  onClose,
  children,
}: PopupProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  // Zamknięcie bez dotykania referencji, żeby dało się je oddać treści panelu: wybranie czegoś zwykle znaczy koniec.
  const dismiss = useCallback(() => {
    setOpen(false);
    onClose?.();
  }, [onClose]);

  const close = useCallback(
    (returnFocus = false) => {
      dismiss();
      if (returnFocus) {
        trigger.current?.focus();
      }
    },
    [dismiss],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (root.current !== null && !root.current.contains(event.target as Node)) {
        close();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close(true);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  const classes = ['ui-popup-trigger', size === 'normal' ? '' : size, hideLabel ? 'icon-only' : '', triggerClassName];

  return (
    <div className="ui-popup" ref={root}>
      <button
        type="button"
        ref={trigger}
        className={classes.filter((name) => name !== '').join(' ')}
        aria-expanded={open}
        aria-controls={panelId}
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {Glyph === undefined ? null : <Glyph />}
        <span className={hideLabel ? 'sr-only' : 'ui-popup-label'}>{label}</span>
        {count === undefined || count === 0 ? null : <span className="ui-badge">{count}</span>}
        {badges}
        {hideLabel ? null : <Chevron className="ui-popup-chevron" />}
      </button>

      {!open ? null : (
        <Panel id={panelId} align={align} scroll={scroll} inline={inline} footer={footer} className={panelClassName}>
          {typeof children === 'function' ? children(dismiss) : children}
        </Panel>
      )}
    </div>
  );
}
