import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { overlayMark } from '@/ui/overlay';
import './HelpTip.css';

/** Odstęp dymka od znaku zapytania i od krawędzi okna. */
const gap = 8;

interface Placement {
  left: number;
  top: number;
}

/**
 * The question mark beside a label, holding the sentence that used to sit under the control.
 */
/*
 * Under the control that line cost a row of height on every field, which is what pushed the practice screen off a phone.
 * Beside the label it costs nothing until it is asked for.
 *
 * Hover opens it and click pins it, because hover alone reaches neither a touch screen nor a keyboard. It is a button, so
 * Tab finds it and Enter opens it; `aria-describedby` ties the text to the label either way.
 *
 * Dymek jest rysowany do `body` i stawiany `fixed` względem znaku zapytania, tak jak lista ComboBoxa (DESIGN.md, rozdz. 5).
 * Rysowany w miejscu był przycinany przez panel popupu, który ma własne przewijanie, a wyśrodkowany nad znakiem przy lewej
 * krawędzi wystawał poza to, co widać. Teraz jest mierzony przy pokazaniu: staje nad znakiem, a gdy tam brakuje miejsca - pod
 * nim, i w poziomie jest dosuwany do okna.
 */
export function HelpTip({ children }: { children: React.ReactNode }) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  /** Stoi w popupie - wtedy jedzie z dymkiem reguła „w panelu jedna czcionka", bo dymek wychodzi z drzewa panelu. */
  const [small, setSmall] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const id = useId();

  const visible = pinned || hovered || focused;

  const measure = (): Placement | null => {
    const trigger = triggerRef.current;
    const bubble = bubbleRef.current;
    if (trigger === null || bubble === null) {
      return null;
    }

    // Czcionka zmienia szerokość dymka, więc klasa musi być na miejscu, zanim zostanie zmierzony - React postawi tę samą.
    const inPanel = trigger.closest('.ui-panel') !== null;
    bubble.classList.toggle('small', inPanel);
    setSmall(inPanel);

    const box = trigger.getBoundingClientRect();
    const width = bubble.offsetWidth;
    const height = bubble.offsetHeight;

    const above = box.top - gap - height;
    const top = above >= gap || box.top > window.innerHeight - box.bottom ? Math.max(gap, above) : box.bottom + gap;

    const centred = box.left + box.width / 2 - width / 2;
    const left = Math.min(Math.max(gap, centred), Math.max(gap, window.innerWidth - gap - width));

    return { left: Math.round(left), top: Math.round(top) };
  };

  /** Mierzony w chwili pokazania, jeszcze przed narysowaniem, żeby nie mignął w starym miejscu - tak jak lista ComboBoxa. */
  const place = () => setPlacement(measure());

  // Znak jedzie z przewijaną zawartością, dymek stoi w oknie - więc przy każdym przewinięciu jest stawiany na nowo.
  useEffect(() => {
    if (!visible) {
      return;
    }

    const follow = () => setPlacement(measure());
    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', follow);

    return () => {
      window.removeEventListener('scroll', follow, true);
      window.removeEventListener('resize', follow);
    };
  }, [visible]);

  const shown = visible && placement !== null;

  return (
    <span className="help-tip" onPointerEnter={() => { place(); setHovered(true); }} onPointerLeave={() => setHovered(false)}>
      <button
        ref={triggerRef}
        type="button"
        className="help-tip-trigger"
        aria-describedby={id}
        aria-expanded={pinned}
        aria-label="Co to znaczy?"
        onClick={() => { place(); setPinned((was) => !was); }}
        onFocus={(event) => {
          const keyboard = event.currentTarget.matches(':focus-visible');
          if (keyboard) {
            place();
          }
          setFocused(keyboard);
        }}
        onBlur={() => { setPinned(false); setFocused(false); }}
      >
        ?
      </button>
      {createPortal(
        <span
          ref={bubbleRef}
          id={id}
          role="tooltip"
          className={`help-tip-bubble${shown ? ' shown' : ''}${small ? ' small' : ''}`}
          style={placement === null ? undefined : { left: placement.left, top: placement.top }}
          // Należy do znaku, który go otworzył: kliknięcie w dymek stojący nad popupem nie jest kliknięciem obok popupu.
          {...{ [overlayMark]: '' }}
        >
          {children}
        </span>,
        document.body,
      )}
    </span>
  );
}
