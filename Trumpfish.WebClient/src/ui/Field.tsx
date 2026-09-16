import type { ReactNode } from 'react';
import { HelpTip } from '@/components/HelpTip';
import { ComboBox } from './ComboBox';
import type { ComboBoxOption } from './ComboBox';
import { TextBox } from './TextBox';
import './controls.css';

interface FieldProps {
  label: string;
  /** Zdanie wyjaśniające, schowane pod znakiem zapytania przy etykiecie - nie pod kontrolką, gdzie kosztuje wiersz. */
  hint?: ReactNode;
  /** Uwaga pod kontrolką: co poszło nie tak, albo co się właśnie stanie. */
  note?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * Etykieta nad kontrolką i nic obok niej.
 */
/*
 * Etykieta obok kontrolki w jednej linii rozjeżdża każdy formularz, w którym jedno pole ma dłuższą nazwę niż drugie, i
 * na telefonie zjada połowę szerokości pola. Zasada jest w DESIGN.md, rozdział 7; tutaj jest jej jedyna implementacja.
 */
export function Field({ label, hint, note, className = '', children }: FieldProps) {
  return (
    <label className={`ui-field ${className}`.trim()}>
      <span className="ui-field-label">
        {label}
        {hint === undefined ? null : <HelpTip>{hint}</HelpTip>}
      </span>
      {children}
      {note === undefined ? null : <span className="ui-field-hint">{note}</span>}
    </label>
  );
}

/** Lista wyboru z etykietą - najczęstsza para w tej aplikacji, więc ma własną nazwę. */
export function ComboBoxField<TValue extends string>({ label, hint, note, value, options, onChange, placeholder, disabled, className }: {
  label: string;
  hint?: ReactNode;
  note?: ReactNode;
  value: TValue;
  options: readonly ComboBoxOption<TValue>[];
  onChange: (value: TValue) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Field label={label} hint={hint} note={note} className={className}>
      <ComboBox value={value} options={options} onChange={onChange} placeholder={placeholder} disabled={disabled} />
    </Field>
  );
}

/** Pole tekstowe z etykietą. */
export function TextBoxField({ label, hint, note, value, onChange, placeholder, disabled, type, onSubmit, className }: {
  label: string;
  hint?: ReactNode;
  note?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  type?: 'text' | 'number' | 'password' | 'search';
  onSubmit?: () => void;
  className?: string;
}) {
  return (
    <Field label={label} hint={hint} note={note} className={className}>
      <TextBox value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} type={type} onSubmit={onSubmit} />
    </Field>
  );
}
