import type { ReactNode } from 'react';
import './controls.css';

interface CheckBoxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  title?: string;
  className?: string;
  children: ReactNode;
}

/** Pole wyboru z etykietą. Celem jest cały wiersz, a nie sam kwadracik - na telefonie to różnica między trafić a nie trafić. */
export function CheckBox({ checked, onChange, disabled = false, title, className = '', children }: CheckBoxProps) {
  return (
    <label className={`ui-check ${className}`.trim()} title={title}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span>{children}</span>
    </label>
  );
}
