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
export function generateDeals(count: number, seed?: string): SimulationDealRequest[] {
  // A seed makes the whole batch deterministic, so the very same deals can be replayed while debugging. Without it every deal is truly random.
  const random = seed === undefined || seed === '' ? Math.random : mulberry32(hashSeed(seed));
  return Array.from({ length: count }, (_, index) => generateDeal(playerPositions[index % playerPositions.length], random));
}

function generateDeal(dealer: PlayerPosition, random: () => number): SimulationDealRequest {
  const deck = shuffle(createDeck(), random);
  return {
    dealer,
    hands: playerPositions.map((position, index) => ({ position, cards: deck.slice(index * 13, (index + 1) * 13) })),
  };
}

function createDeck(): SimulationCard[] {
  return cardColors.flatMap((color) => cardValues.map((value) => ({ value, color, label: cardLabel({ value, color }) })));
}

/** Fisher-Yates, so every permutation of the deck is equally likely. */
function shuffle(deck: SimulationCard[], random: () => number): SimulationCard[] {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

/** FNV-1a, so any textual seed maps to a stable 32 bit state. */
function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

/** Mulberry32 - small, fast and good enough for reproducible shuffles. */
function mulberry32(state: number): () => number {
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Single letter seat labels, as a bridge diagram writes them. */
export const positionLabels: Record<PlayerPosition, string> = { North: 'N', East: 'E', South: 'S', West: 'W' };
