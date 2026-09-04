import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import './Select.css';

export interface SelectOption<TValue extends string> {
  value: TValue;
  label: string;
  /** Optional class applied to the label, used by the bid editor to tint suits. */
  labelClassName?: string;
}

interface SelectProps<TValue extends string> {
  value: TValue;
  options: readonly SelectOption<TValue>[];
  onChange: (value: TValue) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  title?: string;
}

/**
 * Listbox styled and animated by us, because a native `select` popup cannot be themed.
 * Keyboard handling mirrors the WAI-ARIA combobox pattern: arrows move the active option, Enter/Space commit, Escape closes.
 */
export function Select<TValue extends string>({ value, options, onChange, placeholder, disabled = false, className = '', title }: SelectProps<TValue>) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dropUp, setDropUp] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  const close = () => {
    setOpen(false);
  };

  const openList = () => {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  const commit = (index: number) => {
    const option = options[index];
    if (option !== undefined) {
      onChange(option.value);
    }

    close();
  };

  // Flip the popup above the field when there is not enough room below it.
  useLayoutEffect(() => {
    if (!open || rootRef.current === null) {
      return;
    }

    const { bottom } = rootRef.current.getBoundingClientRect();
    setDropUp(window.innerHeight - bottom < 260);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current !== null && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      listRef.current?.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
    }
  }, [open, activeIndex]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }

    if (event.key === 'Escape') {
      close();
      return;
    }

    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault();
        openList();
      }

      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => (current + step + options.length) % options.length);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setActiveIndex(event.key === 'Home' ? 0 : options.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      commit(activeIndex);
    } else if (event.key === 'Tab') {
      close();
    }
  };

  /**
   * A `Select` is usually written inside a `<label>`, and a label forwards a click landing on its non-interactive content to
   * the first labelable control it holds - here the field button. Committing an option would therefore be followed by a
   * second click on the field, reopening the list the moment it closed. Cancelling the click stops that forwarding; nothing
   * inside the component relies on a click's default behaviour.
   */
  const keepLabelOut = (event: React.MouseEvent) => event.preventDefault();

  return (
    <div ref={rootRef} className={`select ${className}`.trim()} onKeyDown={onKeyDown} onClick={keepLabelOut} title={title}>
      <button
        type="button"
        className={`select-field${open ? ' open' : ''}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => (open ? close() : openList())}
      >
        <span className={`select-value${selected === null ? ' placeholder' : ''} ${selected?.labelClassName ?? ''}`.trimEnd()}>
          {selected?.label ?? placeholder ?? ''}
        </span>
        <Chevron className="select-chevron" />
      </button>

      {open && (
        <ul ref={listRef} id={listId} className={`select-list${dropUp ? ' drop-up' : ''}`} role="listbox" tabIndex={-1}>
          {options.map((option, index) => (
            <li
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              className={`select-option${index === activeIndex ? ' active' : ''}${option.value === value ? ' selected' : ''}`}
              onPointerEnter={() => setActiveIndex(index)}
              onClick={() => commit(index)}
            >
              <span className={option.labelClassName}>{option.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Shared vector chevron: crisp at every size and rotatable, unlike the text glyphs it replaces. */
export function Chevron({ className = '' }: { className?: string }) {
  return (
    <svg className={`chevron ${className}`.trim()} viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false">
      <path d="M9 5.5 15.5 12 9 18.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
