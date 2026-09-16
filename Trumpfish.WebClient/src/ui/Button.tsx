import type { ButtonHTMLAttributes, ComponentType, ReactNode } from 'react';
import './controls.css';

/** Trzy rozmiary i żadnego czwartego. Który gdzie stoi, mówi tabela w `.claude/DESIGN.md`, rozdział 2. */
export type ControlSize = 'large' | 'normal' | 'small';

/** Dwa style: zwykła ciemna płytka i akcent. `danger` to nie trzeci styl, tylko czerwony hover rzeczy nieodwracalnej. */
export type ButtonVariant = 'standard' | 'primary' | 'danger';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  size?: ControlSize;
  variant?: ButtonVariant;
  /** Znak przed słowem. Wymagany wszędzie, gdzie przycisk ma słowo - taka jest zasada, nie upiększenie. */
  icon?: ComponentType<{ className?: string }>;
  /** Sam znak, bez słowa. `label` staje się wtedy nazwą dla czytnika ekranu i dymkiem. */
  iconOnly?: boolean;
  children?: ReactNode;
}

/**
 * Przycisk aplikacji.
 */
/*
 * Istnieje po to, żeby trzy rzeczy nie dały się zapomnieć: rozmiar jest jednym z trzech, słowo zawsze siedzi w `<span>`
 * (pasek narzędzi chowa słowa poniżej 560 px, a chowa właśnie `button > span`), i przy słowie stoi znak.
 */
export function Button({ size = 'normal', variant = 'standard', icon: Glyph, iconOnly = false, className = '', type = 'button', children, ...rest }: ButtonProps) {
  const classes = [
    size === 'normal' ? '' : size,
    variant === 'standard' ? '' : variant,
    iconOnly ? 'icon-only' : '',
    className,
  ].filter((name) => name !== '');

  return (
    <button type={type} className={classes.join(' ')} {...rest}>
      {Glyph === undefined ? null : <Glyph />}
      {iconOnly || children === undefined ? null : <span>{children}</span>}
    </button>
  );
}
