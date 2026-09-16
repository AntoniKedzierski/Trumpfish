import type { InputHTMLAttributes, Ref } from 'react';
import './controls.css';

interface TextBoxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value: string;
  onChange: (value: string) => void;
  /** Tylko pola tekstowe. Liczby chodzą przez `type="number"`, reszta typów HTML nie występuje w tej aplikacji. */
  type?: 'text' | 'number' | 'password' | 'search';
  /** Przykład, nie instrukcja: jedno słowo albo jedna wartość (DESIGN.md, rozdział 7). */
  placeholder?: string;
  /** Wywoływane po Enterze, żeby pole w panelu nie musiało za każdym razem pisać obsługi klawisza. */
  onSubmit?: () => void;
  /** React 19 przekazuje referencję jak zwykły atrybut, więc pole może ją oddać dalej bez opakowania. */
  ref?: Ref<HTMLInputElement>;
}

/** Pole tekstowe: wysokość zwykłego przycisku, pismo o stopień niższe od etykiety nad nim. */
export function TextBox({ value, onChange, type = 'text', onSubmit, onKeyDown, className = '', ...rest }: TextBoxProps) {
  return (
    <input
      type={type}
      value={value}
      className={className}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.key === 'Enter' && onSubmit !== undefined) {
          event.preventDefault();
          onSubmit();
        }
      }}
      {...rest}
    />
  );
}
