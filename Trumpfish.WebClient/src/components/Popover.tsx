import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Chevron } from './Select';
import './Popover.css';

interface PopoverProps {
  label: string;
  /** Drawn before the label on the trigger. */
  icon?: React.ReactNode;
  /** How many constraints are in force, shown on the trigger so a folded-away filter cannot be forgotten about. */
  count?: number;
  /** Run as the panel closes, whatever closed it. Given only where closing the panel is meant to mean something. */
  onClose?: () => void;
  /** Held out of the scrolling area, so the commands stay put however long the panel's contents get. */
  footer?: React.ReactNode;
  /**
   * Whether the body scrolls when it outgrows the panel. An overflow container clips anything positioned out of it, so a
   * panel holding a control that opens a flyout of its own has to say no.
   */
  scrollBody?: boolean;
  children: React.ReactNode;
}

/**
 * A named trigger with a panel of controls under it - a filter sheet rather than a list of commands.
 */
/*
 * Unlike the menus elsewhere, this one is edited rather than picked from, so it does not close on the first click inside
 * it, and closing is meaningful: `onClose` fires whatever dismissed the panel, which is what lets the caller treat "click
 * away" as "apply".
 *
 * It does not use `useDisclosure` for exactly that reason - the hook closes the panel on its own and there would be no
 * single place left to hang the commit on.
 */
export function Popover({ label, icon, count, onClose, footer, scrollBody = true, children }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const close = useCallback(
    (returnFocus: boolean) => {
      setOpen(false);
      onClose?.();
      if (returnFocus) {
        trigger.current?.focus();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (root.current !== null && !root.current.contains(event.target as Node)) {
        close(false);
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

  return (
    <div className="popover" ref={root}>
      <button
        type="button"
        ref={trigger}
        className="popover-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? close(false) : setOpen(true))}
      >
        {icon}
        <span>{label}</span>
        {count === undefined || count === 0 ? null : <span className="popover-count">{count}</span>}
        <Chevron className="popover-chevron" />
      </button>

      {!open ? null : (
        <div className={scrollBody ? 'popover-panel' : 'popover-panel unclipped'} id={panelId}>
          <div className="popover-body">{children}</div>
          {footer === undefined ? null : <div className="popover-footer">{footer}</div>}
        </div>
      )}
    </div>
  );
}
