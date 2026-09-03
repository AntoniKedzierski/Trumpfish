import { useState, type KeyboardEvent, type PointerEvent } from 'react';

interface PaneSplitterProps {
  /** Current width of the pane on the right, in pixels. */
  width: number;
  onWidthChange: (width: number) => void;
  /** Smallest the right pane may get, and the room always left for the pane on the left. */
  minWidth?: number;
  minOppositeWidth?: number;
  /** How far one arrow key press moves the divider. */
  step?: number;
}

/**
 * Drag handle between the tree and the editor. It reports a width for the pane on the right, so dragging left widens the
 * editor at the tree's expense; the upper bound comes from the row it sits in, which keeps the tree usable at any window size.
 */
export function PaneSplitter({ width, onWidthChange, minWidth = 300, minOppositeWidth = 320, step = 24 }: PaneSplitterProps) {
  const [dragging, setDragging] = useState(false);

  const limitsFor = (handle: HTMLElement) => {
    const row = handle.parentElement?.getBoundingClientRect().width ?? 0;
    return { min: minWidth, max: Math.max(minWidth, row - minOppositeWidth) };
  };

  const beginDrag = (event: PointerEvent<HTMLDivElement>) => {
    // Stops the drag from turning into a text selection across the panes it passes over.
    event.preventDefault();

    const handle = event.currentTarget;
    const { min, max } = limitsFor(handle);
    const startX = event.clientX;
    const startWidth = width;

    // Pointer capture routes the rest of the gesture here, so the drag survives the cursor leaving the handle.
    handle.setPointerCapture(event.pointerId);
    setDragging(true);

    const move = (moveEvent: globalThis.PointerEvent) => {
      onWidthChange(clamp(startWidth + (startX - moveEvent.clientX), min, max));
    };

    const end = () => {
      handle.releasePointerCapture(event.pointerId);
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      setDragging(false);
    };

    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  };

  const nudge = (event: KeyboardEvent<HTMLDivElement>) => {
    const offset = event.key === 'ArrowLeft' ? step : event.key === 'ArrowRight' ? -step : 0;
    if (offset === 0) {
      return;
    }

    event.preventDefault();
    const { min, max } = limitsFor(event.currentTarget);
    onWidthChange(clamp(width + offset, min, max));
  };

  return (
    <div
      className={`workspace-splitter${dragging ? ' dragging' : ''}`}
      role="separator"
      aria-orientation="vertical"
      aria-label="Szerokość edytora"
      tabIndex={0}
      onPointerDown={beginDrag}
      onKeyDown={nudge}
    />
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
