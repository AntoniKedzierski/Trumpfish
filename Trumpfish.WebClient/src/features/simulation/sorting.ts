import { toNumber } from '@/api/models';
import type { SimulationContract, SimulationDealResult } from '@/api/models';

export type SortKey = 'index' | 'contract' | 'points' | 'contractThenPoints' | 'pointsThenContract';

export type SortDirection = 'asc' | 'desc';

export const sortKeyLabels: Record<SortKey, string> = {
  index: 'Kolejność rozdań',
  contract: 'Wysokość kontraktu',
  points: 'Punkty pary',
  contractThenPoints: 'Kontrakt, potem punkty',
  pointsThenContract: 'Punkty, potem kontrakt',
};

export const sortDirectionLabels: Record<SortDirection, string> = { desc: 'Malejąco', asc: 'Rosnąco' };

/** Level a contract has to reach in a given denomination to be a game: 3NT, 4 in a major, 5 in a minor. */
const gameLevels: Record<string, number> = { NoTrump: 3, Spades: 4, Hearts: 4, Diamonds: 5, Clubs: 5 };

export function makesGame(contract: SimulationContract): boolean {
  const value = toNumber(contract.value);
  if (contract.passed || value === null) {
    return false;
  }

  const required = gameLevels[contract.color];
  return required !== undefined && value >= required;
}

/** Sorts a copy of the deals; pass-outs always rank lowest so they collect at the far end of a descending list. */
export function sortDeals(deals: readonly SimulationDealResult[], key: SortKey, direction: SortDirection): SimulationDealResult[] {
  if (key === 'index') {
    const byIndex = [...deals].sort((left, right) => (toNumber(left.index) ?? 0) - (toNumber(right.index) ?? 0));
    return direction === 'asc' ? byIndex : byIndex.reverse();
  }

  const sign = direction === 'asc' ? 1 : -1;
  return [...deals].sort((left, right) => sign * compare(left, right, key) || (toNumber(left.index) ?? 0) - (toNumber(right.index) ?? 0));
}

function compare(left: SimulationDealResult, right: SimulationDealResult, key: SortKey): number {
  switch (key) {
    case 'contract':
      return contractRank(left) - contractRank(right);
    case 'points':
      return pairPoints(left) - pairPoints(right);
    case 'contractThenPoints':
      return contractRank(left) - contractRank(right) || pairPoints(left) - pairPoints(right);
    default:
      return pairPoints(left) - pairPoints(right) || contractRank(left) - contractRank(right);
  }
}

/** Ranks contracts the way the auction does: level first, then ♣ < ♦ < ♥ < ♠ < NT. */
function contractRank(deal: SimulationDealResult): number {
  const value = toNumber(deal.contract.value);
  if (deal.contract.passed || value === null) {
    return -1;
  }

  const order: Record<string, number> = { Clubs: 0, Diamonds: 1, Hearts: 2, Spades: 3, NoTrump: 4 };
  return value * 10 + (order[deal.contract.color] ?? 0);
}

function pairPoints(deal: SimulationDealResult): number {
  return toNumber(deal.contract.pairPoints) ?? -1;
}
