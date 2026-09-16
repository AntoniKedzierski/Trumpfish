import { useEffect, useId } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import { CheckIcon, CloseIcon } from '@/components/icons';
import './dialog.css';

interface DialogProps {
  title: string;
  /** Zamknięcie bez decyzji: Escape, kliknięcie w tło, przycisk odrzucenia. */
  onClose: () => void;
  /** Rząd komend na dole. Najwyżej jedna z nich jest akcentowana - okno liczy się jako osobny widok. */
  actions?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}

/**
 * Okno modalne aplikacji.
 */
/*
 * Rysowane do `body`, a nie w miejscu wywołania: strona pod spodem bywa ramką z własnym przewijaniem i własnym
 * `backdrop-filter`, a okno zaczepione w takiej ramce jest oknem wysokości tej ramki.
 */
export function Dialog({ title, onClose, actions, wide = false, children }: DialogProps) {
  const titleId = useId();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const scroll = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = scroll;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div className="ui-dialog-backdrop" role="presentation" onClick={onClose}>
      {/* Okno nie jest tłem: kliknięcie w środku jest wyborem, a nie rezygnacją. */}
      <div
        className={wide ? 'ui-dialog wide' : 'ui-dialog'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="ui-dialog-title" id={titleId}>{title}</h2>
        <div className="ui-dialog-body">{children}</div>
        {actions === undefined ? null : <div className="ui-dialog-actions">{actions}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Pytanie z dwiema odpowiedziami. Sześć miejsc zadawało je na sześć sposobów. */
export function ConfirmDialog({ title, question, confirmLabel, confirmIcon, cancelLabel = 'Anuluj', danger = false, busy = false, onConfirm, onClose, children }: {
  title: string;
  question?: ReactNode;
  confirmLabel: string;
  confirmIcon?: React.ComponentType<{ className?: string }>;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <Dialog
      title={title}
      onClose={onClose}
      actions={
        <>
          <Button size="small" icon={CloseIcon} onClick={onClose}>{cancelLabel}</Button>
          <Button
            size="small"
            icon={confirmIcon ?? CheckIcon}
            variant={danger ? 'danger' : 'primary'}
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {question === undefined ? null : <p className="ui-dialog-text">{question}</p>}
      {children}
    </Dialog>
  );
}
