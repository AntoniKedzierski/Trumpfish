/**
 * Stops the mouse wheel from stepping a number field.
 *
 * A focused `<input type="number">` treats a wheel tick as increment or decrement, which quietly rewrites a points range or a
 * deal count while the author is only scrolling past it. Blurring the field is what disarms that: the browser applies the step
 * as the default action after this listener runs, and an unfocused input has no step to apply. Preventing the default instead
 * would also kill the scroll itself, leaving the wheel dead wherever it happened to be over a field.
 *
 * Registered natively rather than as a React `onWheel`, because React attaches wheel listeners passively - a `preventDefault`
 * from a synthetic handler is ignored - and because one registration covers every number field in the application, including
 * any added later.
 */
export function keepWheelOffNumberInputs(): void {
  document.addEventListener(
    'wheel',
    (event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement && target.type === 'number' && target === document.activeElement) {
        target.blur();
      }
    },
    // Capture, so the field is out of focus before anything downstream reacts to the same tick.
    { capture: true },
  );
}
