import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { overlayMark } from './overlay';
import './comboBox.css';

export interface ComboBoxOption<TValue extends string> {
  value: TValue;
  label: string;
  /** Optional class applied to the label, used by the bid editor to tint suits. */
  labelClassName?: string;
  /**
   * What to draw instead of `label`, when the option carries something a string cannot - a tinted suit mark, say. `label`
   * is still required and still what the option is announced and titled by.
   */
  labelNode?: React.ReactNode;
}

interface ComboBoxProps<TValue extends string> {
  value: TValue;
  options: readonly ComboBoxOption<TValue>[];
  onChange: (value: TValue) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  title?: string;
}

/**
 * Gdzie stoi otwarta lista wartości. Liczona z położenia pola, bo lista jest rysowana do `body`, a nie pod polem.
 */
interface Placement {
  left: number;
  width: number;
  /** Jedna z dwóch krawędzi jest ustawiona, druga jest `auto` - lista opada albo wznosi się od pola. */
  top: number | 'auto';
  bottom: number | 'auto';
  up: boolean;
  /** Czy lista należy do pola stojącego w popupie, gdzie wszystko jest małe (DESIGN.md, rozdział 5). */
  small: boolean;
}

/**
 * Listbox styled and animated by us, because a native `select` popup cannot be themed.
 * Keyboard handling mirrors the WAI-ARIA combobox pattern: arrows move the active option, Enter/Space commit, Escape closes.
 */
/*
 * Otwarta lista jest rysowana do `body` i pozycjonowana `fixed` z prostokąta pola. Rysowana pod polem, obcinała ją każda
 * ramka z własnym przewijaniem albo wysokością - panel popupu, karta, kolumna edytora - a lista wartości ucięta w
 * połowie drugiej pozycji to lista, z której nie da się wybrać. Żaden kontener nadrzędny nie ma prawa jej przyciąć.
 */
export function ComboBox<TValue extends string>({ value, options, onChange, placeholder, disabled = false, className = '', title }: ComboBoxProps<TValue>) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  const close = () => {
    setOpen(false);
  };

  /**
   * Gdzie postawić listę. Liczone przy otwarciu i przy każdym przewinięciu, bo `fixed` nie jedzie z ramką, w której
   * stoi pole. Lista wznosi się do góry dopiero wtedy, gdy nad polem jest jej wyraźnie wygodniej niż pod nim.
   */
  const measure = (): Placement | null => {
    const field = fieldRef.current;
    if (field === null) {
      return null;
    }

    const box = field.getBoundingClientRect();
    const below = window.innerHeight - box.bottom;
    const up = below < 260 && box.top > below;

    return {
      left: box.left,
      width: box.width,
      top: up ? 'auto' : box.bottom + 6,
      bottom: up ? window.innerHeight - box.top + 6 : 'auto',
      up,
      // Pytane raz, przy otwarciu: lista wychodzi z drzewa panelu, więc reguła „w popupie wszystko jest małe" musi z nią pojechać.
      small: rootRef.current?.closest('.ui-panel') != null,
    };
  };

  const openList = () => {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setPlacement(measure());
    setOpen(true);
  };

  const commit = (index: number) => {
    const option = options[index];
    if (option !== undefined) {
      onChange(option.value);
    }

    close();
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const inside = rootRef.current?.contains(target) === true || listRef.current?.contains(target) === true;

      if (!inside) {
        setOpen(false);
      }
    };

    // Pole jedzie z przewijaną zawartością, lista stoi w oknie - więc przy każdym przewinięciu jest stawiana na nowo.
    const follow = () => setPlacement(measure());

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', follow);

    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('scroll', follow, true);
      window.removeEventListener('resize', follow);
    };
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
   * A `ComboBox` is usually written inside a `<label>`, and a label forwards a click landing on its non-interactive content to
   * the first labelable control it holds - here the field button. Committing an option would therefore be followed by a
   * second click on the field, reopening the list the moment it closed. Cancelling the click stops that forwarding; nothing
   * inside the component relies on a click's default behaviour.
   */
  const keepLabelOut = (event: React.MouseEvent) => event.preventDefault();

  return (
    <div ref={rootRef} className={`ui-combo ${className}`.trim()} onKeyDown={onKeyDown} onClick={keepLabelOut} title={title}>
      <button
        type="button"
        ref={fieldRef}
        className={`ui-combo-field${open ? ' open' : ''}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => (open ? close() : openList())}
      >
        <span className={`ui-combo-value${selected === null ? ' placeholder' : ''} ${selected?.labelClassName ?? ''}`.trimEnd()}>
          {selected?.labelNode ?? selected?.label ?? placeholder ?? ''}
        </span>
        <Chevron className="ui-combo-chevron" />
      </button>

      {!open || placement === null ? null : createPortal(
        <ul
          ref={listRef}
          id={listId}
          {...{ [overlayMark]: '' }}
          className={`ui-combo-list${placement.up ? ' drop-up' : ''}${placement.small ? ' small' : ''}`}
          style={{ left: placement.left, width: placement.width, top: placement.top, bottom: placement.bottom }}
          role="listbox"
          tabIndex={-1}
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              className={`ui-combo-option${index === activeIndex ? ' active' : ''}${option.value === value ? ' selected' : ''}`}
              title={option.label}
              onPointerEnter={() => setActiveIndex(index)}
              onClick={() => commit(index)}
            >
              <span className={option.labelClassName}>{option.labelNode ?? option.label}</span>
            </li>
          ))}
        </ul>,
        document.body,
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
