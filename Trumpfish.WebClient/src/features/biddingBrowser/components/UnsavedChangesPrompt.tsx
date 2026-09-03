import type { Blocker } from 'react-router-dom';

/**
 * Shown when a navigation was held back because the open system has edits that were never saved. Rendered as a dialog rather
 * than a `window.confirm` because the confirm would have to be called from an effect, and a router blocker resolved from
 * inside an effect is easy to leave stuck between states.
 */
export function UnsavedChangesPrompt({ blocker }: { blocker: Blocker }) {
  if (blocker.state !== 'blocked') {
    return null;
  }

  return (
    <div className="unsaved-backdrop" role="presentation" onClick={() => blocker.reset?.()}>
      <div className="unsaved-dialog" role="alertdialog" aria-modal="true" aria-labelledby="unsaved-title" onClick={(event) => event.stopPropagation()}>
        <h2 id="unsaved-title">Niezapisane zmiany</h2>
        <p>W tym systemie są zmiany, których nie zapisano na serwerze. Jeśli opuścisz stronę, przepadną.</p>
        <div className="unsaved-actions">
          <button type="button" autoFocus onClick={() => blocker.reset?.()}>Zostań</button>
          <button type="button" className="danger" onClick={() => blocker.proceed?.()}>Opuść bez zapisywania</button>
        </div>
      </div>
    </div>
  );
}
