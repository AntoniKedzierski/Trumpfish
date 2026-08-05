import { cardColors, cardValues, playerPositions } from '@/api/models';
import type { CardColor, PlayerPosition, SimulationCard, SimulationDealRequest } from '@/api/models';

const cardLabels: Record<string, string> = {
  Two: '2',
  Three: '3',
  Four: '4',
  Five: '5',
  Six: '6',
  Seven: '7',
  Eight: '8',
  Nine: '9',
  Ten: '10',
  Jack: 'J',
  Queen: 'Q',
  King: 'K',
  Ace: 'A',
};

const suitMarks: Record<CardColor, string> = { Clubs: '♣', Diamonds: '♦', Hearts: '♥', Spades: '♠' };

export function cardLabel(card: Pick<SimulationCard, 'value' | 'color'>): string {
  return `${cardLabels[card.value] ?? card.value}${suitMarks[card.color]}`;
}

export function suitOfCard(color: CardColor): string {
  return `suit ${color.toLowerCase()}`;
}

/** Deals are generated in the browser (the server only simulates), so a run is fully reproducible from what the client sent. */
export function generateDeals(count: number): SimulationDealRequest[] {
  return Array.from({ length: count }, (_, index) => generateDeal(playerPositions[index % playerPositions.length]));
}

function generateDeal(dealer: PlayerPosition): SimulationDealRequest {
  const deck = shuffle(createDeck());
  return {
    dealer,
    hands: playerPositions.map((position, index) => ({ position, cards: deck.slice(index * 13, (index + 1) * 13) })),
  };
}

function createDeck(): SimulationCard[] {
  return cardColors.flatMap((color) => cardValues.map((value) => ({ value, color, label: cardLabel({ value, color }) })));
}

/** Fisher-Yates, so every permutation of the deck is equally likely. */
function shuffle(deck: SimulationCard[]): SimulationCard[] {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}
