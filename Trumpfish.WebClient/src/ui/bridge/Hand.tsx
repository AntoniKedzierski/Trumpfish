import type { SimulationHand } from '@/api/models';
import { cardColors, cardLabel, cardValues, playerPositions, positionLabels } from '@/api/models';
import { SuitMark } from '@/components/suits';
import './deal.css';

/** Jedna ręka: cztery wiersze kolorów, punkty i rozkład. */
export function Hand({ hand }: { hand: SimulationHand }) {
  return (
    <div className="hand">
      <div className="hand-header">
        <span className="hand-position">{positionLabels[hand.position]}</span>
        <span className="hand-points" title="Punkty honorowe / punkty w grze bezatutowej">
          {hand.points} PC · {hand.pointsNt} NT
        </span>
        <span className="hand-shape">
          {hand.spades}-{hand.hearts}-{hand.diamonds}-{hand.clubs}
        </span>
      </div>

      <ul className="hand-suits">
        {[...cardColors].reverse().map((color) => (
          <li key={color}>
            {/* Znak stoi we własnym pudełku, żeby wiersz wyrównywał dwa kawałki tekstu, a nie tekst i obrazek. */}
            <span className="hand-suit">
              <SuitMark suit={color} />
            </span>
            <span className="hand-cards">
              {hand.cards
                .filter((card) => card.color === color)
                .sort((left, right) => cardValues.indexOf(right.value) - cardValues.indexOf(left.value))
                .map((card) => cardLabel(card).slice(0, -1))
                .join(' ') || '—'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Cztery ręce w układzie dwa na dwa, na każdej szerokości.
 */
/*
 * Ustawione jedna pod drugą są kolumną na cztery ekrany, a to, po co się na rozdanie patrzy - jak karty leżą naprzeciw
 * siebie - jest dokładnie tym, co taki układ zabiera. Karty w ręce są na tyle krótkie, że przeżyją pół telefonu.
 */
export function Deal({ hands }: { hands: readonly SimulationHand[] }) {
  const bySeat = new Map(hands.map((hand) => [hand.position, hand]));

  return (
    <div className="hands">
      {playerPositions.map((position) => {
        const hand = bySeat.get(position);
        return hand === undefined ? null : <Hand key={position} hand={hand} />;
      })}
    </div>
  );
}
