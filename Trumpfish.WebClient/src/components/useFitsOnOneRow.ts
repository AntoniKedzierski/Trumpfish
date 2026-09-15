import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

/**
 * Whether a row of controls still fits across its container, measured rather than guessed.
 */
/*
 * A breakpoint would be a number standing in for the answer, and it would be wrong the day a tool is added to the bar or
 * somebody is called something longer than expected. What is actually being asked is whether these particular controls fit
 * across this particular window, and that is a measurement.
 *
 * The width needed is the sum of the children's own widths plus the gaps between them, taken while everything is still on
 * screen - so it is right even on the very first pass, when the bar has already wrapped and there has never been a moment
 * at which it fitted. An automatic margin pushing the last group to the end contributes nothing to that sum, which is
 * correct: it is slack, not content.
 *
 * Once folded away the row cannot be measured any more - what would be measured is the folded version, which fits by
 * definition - so the last requirement is kept and the row comes back only above it. That is what stops the two states
 * from flipping between each other at the boundary.
 */
export function useFitsOnOneRow<T extends HTMLElement>(ref: RefObject<T | null>): boolean {
  const [fits, setFits] = useState(true);
  const current = useRef(true);
  const needed = useRef(0);

  useEffect(() => {
    const element = ref.current;
    if (element === null) {
      return;
    }

    const measure = () => {
      // `clientWidth` counts the padding, so the requirement has to count it too.
      const style = window.getComputedStyle(element);
      const room = element.clientWidth;

      if (!current.current) {
        if (room >= needed.current) {
          current.current = true;
          setFits(true);
        }

        return;
      }

      const children = [...element.children] as HTMLElement[];
      const gap = Number.parseFloat(style.columnGap) || 0;
      const padding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);

      needed.current =
        padding + Math.max(0, children.length - 1) * gap + children.reduce((total, child) => total + child.offsetWidth, 0);

      if (needed.current > room) {
        current.current = false;
        setFits(false);
      }
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return fits;
}
