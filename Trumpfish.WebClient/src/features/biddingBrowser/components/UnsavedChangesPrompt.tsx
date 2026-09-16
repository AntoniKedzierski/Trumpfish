import type { Blocker } from 'react-router-dom';
import { CloseIcon } from '@/components/icons';
import { ConfirmDialog } from '@/ui';

/**
 * Pokazywane, kiedy przejście zostało wstrzymane, bo otwarty system ma zmiany, których nigdy nie zapisano.
 */
/*
 * Okno, a nie `window.confirm`: confirm musiałby być wołany z efektu, a blokada routera rozstrzygana z wnętrza efektu
 * łatwo zostaje zawieszona między stanami.
 */
export function UnsavedChangesPrompt({ blocker }: { blocker: Blocker }) {
  if (blocker.state !== 'blocked') {
    return null;
  }

  return (
    <ConfirmDialog
      title="Niezapisane zmiany"
      question="W tym systemie są zmiany, których nie zapisano na serwerze. Jeśli opuścisz stronę, przepadną."
      cancelLabel="Zostań"
      confirmLabel="Opuść bez zapisywania"
      confirmIcon={CloseIcon}
      danger
      onConfirm={() => blocker.proceed?.()}
      onClose={() => blocker.reset?.()}
    />
  );
}
