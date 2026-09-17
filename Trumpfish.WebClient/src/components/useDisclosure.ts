import { useEffect, useRef, useState } from 'react';
import { isInsideOverlay } from '@/ui/overlay';

/**
 * The behaviour every dropdown in the top bar shares: it closes on a click outside and on Escape, and Escape hands the focus
 * back to the trigger rather than dropping it on an element that has just stopped existing.
 */
export function useDisclosure<T extends HTMLElement>() {
  const [open, setOpen] = useState(false);
  const root = useRef<T>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      // Lista wartości otwarta w środku jest rysowana do `body`, więc leży poza dropdownem, choć należy do niego.
      if (root.current !== null && !root.current.contains(event.target as Node) && !isInsideOverlay(event.target)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return { open, setOpen, root, trigger };
}
