import { playerPositions, toNumber } from '@/api/models';
import type { BidColor, BidType, PlayerPosition, SimulationContract, SimulationDealResult } from '@/api/models';
import { makesGame } from './sorting';

/** Whether one or both pairs actually entered the auction. */
export type SideFilterKey = 'any' | 'oneSide' | 'twoSide';

/** Contract level filters, independent of who bid. */
export type GameFilterKey = 'any' | 'game' | 'gameWithPoints' | 'gameWithoutPoints' | 'pointsWithoutGame' | 'errors' | 'anyGame' | 'slam' | 'grandSlam';

export const sideFilterLabels: Record<SideFilterKey, string> = {
  any: 'Dowolna licytacja',
  oneSide: 'Licytacja jednostronna',
  twoSide: 'Licytacja dwustronna',
};

export const gameFilterLabels: Record<GameFilterKey, string> = {
  any: 'Dowolny kontrakt',
  game: 'Partie',
  gameWithPoints: 'Partie z pokryciem',
  gameWithoutPoints: 'Partie bez pokrycia',
  pointsWithoutGame: 'Pokrycie bez partii',
  errors: 'Błędy',
  anyGame: 'Partie i szlemy',
  slam: 'Szlemiki i szlemy (6+)',
  grandSlam: 'Szlemy (7)',
};

/** Minimum combined strength (and trump fit for suits) that makes a game contract sound. */
const gameRequirements: Record<string, { points: number; trumps?: number }> = {
  NoTrump: { points: 25 },
  Spades: { points: 24, trumps: 8 },
  Hearts: { points: 24, trumps: 8 },
  Diamonds: { points: 27, trumps: 9 },
  Clubs: { points: 27, trumps: 9 },
};

export function filterDeals(deals: readonly SimulationDealResult[], side: SideFilterKey, game: GameFilterKey, bidSearch: string): SimulationDealResult[] {
  const wanted = parseBid(bidSearch);
  return deals.filter((deal) => matchesSide(deal, side) && matchesGame(deal, game) && matchesBid(deal, wanted));
}

function matchesSide(deal: SimulationDealResult, filter: SideFilterKey): boolean {
  switch (filter) {
    case 'oneSide':
      return biddingPairs(deal).length <= 1;
    case 'twoSide':
      return biddingPairs(deal).length === 2;
    default:
      return true;
  }
}

function matchesGame(deal: SimulationDealResult, filter: GameFilterKey): boolean {
  // "Game" here means exactly game level, so slams can be inspected separately; "anyGame" covers game level and above.
  const contract = deal.contract;
  const game = makesGame(contract) && !atLeastLevel(contract, 6);

  switch (filter) {
    case 'game':
      return game;
    case 'gameWithPoints':
      return game && hasGameValues(contract);
    case 'gameWithoutPoints':
      return game && !hasGameValues(contract);
    case 'pointsWithoutGame':
      return !makesGame(contract) && hasGameValues(contract);
    case 'errors':
      return hasErrors(deal);
    case 'anyGame':
      return makesGame(contract);
    case 'slam':
      return atLeastLevel(contract, 6);
    case 'grandSlam':
      return atLeastLevel(contract, 7);
    default:
      return true;
  }
}

/** Pairs (0 = N/S, 1 = E/W) that actually contested the auction - passes, doubles and redoubles do not count as entering it. */
function biddingPairs(deal: SimulationDealResult): number[] {
  const pairs = new Set<number>();
  deal.bidding.forEach((bid) => {
    if (bid.type === 'Submit') {
      pairs.add(pairOf(bid.bidder));
    }
  });

  return [...pairs];
}

function pairOf(position: PlayerPosition): number {
  return playerPositions.indexOf(position) % 2;
}

/** Whether the declaring pair actually holds game values in the contract's denomination: enough points and, for suits, a long enough trump fit. */
function hasGameValues(contract: SimulationContract): boolean {
  const requirement = gameRequirements[contract.color];
  const points = toNumber(contract.pairPoints);
  if (contract.passed || requirement === undefined || points === null) {
    return false;
  }

  const trumps = toNumber(contract.trumpCount) ?? 0;
  return points >= requirement.points && (requirement.trumps === undefined || trumps >= requirement.trumps);
}

function atLeastLevel(contract: SimulationContract, level: number): boolean {
  const value = toNumber(contract.value);
  return !contract.passed && value !== null && value >= level;
}

function hasErrors(deal: SimulationDealResult): boolean {
  return Boolean(deal.error);
}

interface BidQuery {
  type: BidType;
  color: BidColor;
  value: number | null;
}

const searchColors: Record<string, BidColor> = {
  c: 'Clubs',
  t: 'Clubs',
  '♣': 'Clubs',
  d: 'Diamonds',
  k: 'Diamonds',
  '♦': 'Diamonds',
  '♢': 'Diamonds',
  h: 'Hearts',
  '♥': 'Hearts',
  '♡': 'Hearts',
  s: 'Spades',
  p: 'Spades',
  '♠': 'Spades',
  nt: 'NoTrump',
  n: 'NoTrump',
  ba: 'NoTrump',
};

/**
 * Parses a search term such as `1NT`, `2h`, `x` or `pass`. A bare level (`3`) matches any bid at that level and a bare
 * denomination (`nt`) matches any level, so the search is useful both for exact bids and for browsing a whole family.
 */
export function parseBid(term: string): BidQuery | null {
  const text = term.trim().toLowerCase();
  if (text === '') {
    return null;
  }

  if (text === 'pass' || text === 'pas' || text === 'p') {
    return { type: 'Pass', color: 'NoColor', value: null };
  }
  if (text === 'x' || text === 'db' || text === 'ktr') {
    return { type: 'Double', color: 'NoColor', value: null };
  }
  if (text === 'xx' || text === 'rdb' || text === 'rktr') {
    return { type: 'Redouble', color: 'NoColor', value: null };
  }

  const match = /^([1-7])?\s*(.*)$/.exec(text);
  if (match === null) {
    return null;
  }

  const [, level, rest] = match;
  const color = rest === '' ? null : (searchColors[rest] ?? null);
  if (level === undefined && color === null) {
    return null;
  }

  return { type: 'Submit', color: color ?? 'NoColor', value: level === undefined ? null : Number(level) };
}

function matchesBid(deal: SimulationDealResult, query: BidQuery | null): boolean {
  if (query === null) {
    return true;
  }

  return deal.bidding.some(
    (bid) =>
      bid.type === query.type &&
      (query.color === 'NoColor' || bid.color === query.color) &&
      (query.value === null || toNumber(bid.value) === query.value),
  );
}
