import { useId, useState } from 'react';
import './HelpTip.css';

/**
 * The question mark beside a label, holding the sentence that used to sit under the control.
 */
/*
 * Under the control that line cost a row of height on every field, which is what pushed the practice screen off a phone.
 * Beside the label it costs nothing until it is asked for.
 *
 * Hover opens it and click pins it, because hover alone reaches neither a touch screen nor a keyboard. It is a button, so
 * Tab finds it and Enter opens it; `aria-describedby` ties the text to the label either way.
 */
export function HelpTip({ children }: { children: React.ReactNode }) {
  const [pinned, setPinned] = useState(false);
  const id = useId();

  return (
    <span className="help-tip">
      <button
        type="button"
        className="help-tip-trigger"
        aria-describedby={id}
        aria-expanded={pinned}
        aria-label="Co to znaczy?"
        onClick={() => setPinned((was) => !was)}
        onBlur={() => setPinned(false)}
      >
        ?
      </button>
      <span id={id} role="tooltip" className={pinned ? 'help-tip-bubble pinned' : 'help-tip-bubble'}>
        {children}
      </span>
    </span>
  );
}
