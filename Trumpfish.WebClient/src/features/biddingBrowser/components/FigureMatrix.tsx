import type { CardColor, CardValue } from '@/api/models';
import { CheckIcon, CloseIcon } from '@/components/icons';
import { SuitMark } from '@/components/suits';

type FigureRequirements = Record<string, boolean>;
type FigureState = 'unset' | 'required' | 'excluded';

interface FigureMatrixProps {
  value: FigureRequirements | null | undefined;
  onChange: (value: FigureRequirements | undefined) => void;
}

const figures: readonly { value: CardValue; mark: string; name: string }[] = [
  { value: 'Ace', mark: 'A', name: 'As' },
  { value: 'King', mark: 'K', name: 'Król' },
  { value: 'Queen', mark: 'Q', name: 'Dama' },
  { value: 'Jack', mark: 'J', name: 'Walet' },
];

// Bridge rank, highest first: spades, hearts, diamonds, clubs.
const suits: readonly { color: CardColor; name: string }[] = [
  { color: 'Spades', name: 'piki' },
  { color: 'Hearts', name: 'kiery' },
  { color: 'Diamonds', name: 'kara' },
  { color: 'Clubs', name: 'trefle' },
];

export function FigureMatrix({ value, onChange }: FigureMatrixProps) {
  const change = (cardValue: CardValue, cardColor: CardColor) => {
    const key = figureKey(cardValue, cardColor);
    const state = figureState(value, key);
    const next = { ...(value ?? {}) };

    if (state === 'unset') {
      next[key] = true;
    }
    else if (state === 'required') {
      next[key] = false;
    }
    else {
      delete next[key];
    }

    onChange(Object.keys(next).length === 0 ? undefined : next);
  };

  return (
    <section className="figure-requirements" aria-labelledby="figure-requirements-heading">
      <h2 id="figure-requirements-heading" className="section">Figury w kolorach</h2>
      <p className="figure-hint">Klikaj: brak → wymagana → wykluczona.</p>

      <table className="figure-matrix">
        <caption className="sr-only">Wymagane i wykluczone figury w poszczególnych kolorach</caption>
        <thead>
          <tr>
            <th scope="col"><span className="sr-only">Figura</span></th>
            {suits.map(({ color, name }) => (
              <th key={color} scope="col" title={name}>
                <SuitMark suit={color} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {figures.map((figure) => (
            <tr key={figure.value}>
              <th scope="row" title={figure.name}>{figure.mark}</th>
              {suits.map(({ color, name }) => {
                const state = figureState(value, figureKey(figure.value, color));
                const nextState = state === 'unset' ? 'wymagana' : state === 'required' ? 'wykluczona' : 'bez wymagania';

                return (
                  <td key={color}>
                    <button
                      type="button"
                      className={`figure-state ${state}`}
                      aria-label={`${figure.name}, ${name}: ${stateLabel(state)}. Kliknij, aby ustawić: ${nextState}.`}
                      title={`${figure.name}, ${name}: ${stateLabel(state)}`}
                      onClick={() => change(figure.value, color)}
                    >
                      {state === 'required' ? <CheckIcon /> : state === 'excluded' ? <CloseIcon /> : null}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function figureKey(value: CardValue, color: CardColor): string {
  return `${value}.${color}`;
}

function figureState(value: FigureRequirements | null | undefined, key: string): FigureState {
  if (value === null || value === undefined || !Object.prototype.hasOwnProperty.call(value, key)) {
    return 'unset';
  }

  return value[key] ? 'required' : 'excluded';
}

function stateLabel(state: FigureState): string {
  if (state === 'required') {
    return 'wymagana';
  }
  if (state === 'excluded') {
    return 'wykluczona';
  }
  return 'bez wymagania';
}
