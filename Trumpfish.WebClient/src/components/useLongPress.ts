import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * How long a press has to be held. Exported because the row being held animates for exactly this long to show that it
 * registered, and a cue that finishes early - or late - is worse than none.
 */
export const longPressDelay = 450;

interface LongPressOptions {
  /** How long the press has to be held. */
  delay?: number;
  /** How far the finger may drift before the press is read as the beginning of a scroll instead. */
  tolerance?: number;
}

/**
 * Press and hold, on a touch screen and with a mouse alike.
 */
/*
 * Pointer events rather than touch events, so one implementation covers a finger, a stylus and a mouse; every browser this
 * application runs in has had them for years.
 *
 * Four things have to be got right for this to work on a phone, and all four are here:
 *
 * - A press that turns into a scroll must not fire. The browser takes the gesture over as soon as it decides the finger is
 *   scrolling and sends `pointercancel`, which cancels the timer; the drift check catches the rest. Note what is *not*
 *   done: `touch-action` is left alone, because setting it to `none` to "own" the gesture would stop the list scrolling
 *   under the finger at all.
 * - Both Android and iOS raise their own context menu on a long press, which would land on top of ours. The default is
 *   prevented.
 * - iOS additionally shows the selection callout, and that is not a `contextmenu` - it is suppressed in the stylesheet
 *   with `-webkit-touch-callout` and `user-select`, on whatever is being held.
 * - Whether a click follows a long press differs between platforms and even between versions. The one that does arrive is
 *   swallowed, so a press cannot also count as a tap - which on a row that expands on a double click would otherwise leave
 *   half a double click lying around.
 */
export function useLongPress(onLongPress: () => void, { delay = longPressDelay, tolerance = 10 }: LongPressOptions = {}) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  // Held in a ref so the handlers below never go stale without having to be rebuilt on every render.
  const callback = useRef(onLongPress);
  useEffect(() => {
    callback.current = onLongPress;
  });

  const cancel = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }

    origin.current = null;
    setHolding(false);
  }, []);

  // A component unmounted mid-press - the tree redraws under the finger often enough - must not fire afterwards.
  useEffect(() => cancel, [cancel]);

  const onPointerDown = (event: React.PointerEvent) => {
    // The main button only, and never a second finger arriving part way through a press.
    if (event.button !== 0 || timer.current !== null) {
      return;
    }

    fired.current = false;
    origin.current = { x: event.clientX, y: event.clientY };
    setHolding(true);

    timer.current = window.setTimeout(() => {
      timer.current = null;
      origin.current = null;
      fired.current = true;
      setHolding(false);
      callback.current();
    }, delay);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const start = origin.current;
    if (start === null) {
      return;
    }

    if (Math.abs(event.clientX - start.x) > tolerance || Math.abs(event.clientY - start.y) > tolerance) {
      cancel();
    }
  };

  return {
    /** True while a press is being timed, so the element can show that the hold has registered. */
    holding,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerCancel: cancel,
      onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
      onClickCapture: (event: React.MouseEvent) => {
        if (!fired.current) {
          return;
        }

        fired.current = false;
        event.preventDefault();
        event.stopPropagation();
      },
    },
  };
}
