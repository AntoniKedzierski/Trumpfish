import type { BiddingSystem, BidNode } from '@/api/models';
import { openingChoices, type OpeningChoice } from './openings';

/** Name of the root holding the defences - bids made after an opponent opened. */
const defencesRootName = 'Obrona';

export interface ConventionChoice {
  /** Matching key, the same one the server compares by - see {@link conventionKey}. */
  key: string;
  /** How the system writes the name; when it is written several ways, the most common spelling. */
  label: string;
  /** Bids of the system carrying it, which hints at how often there is something to practise. */
  bids: number;
  /** Openings after which the convention can come up, in tree order. */
  openings: OpeningChoice[];
  /** Whether it can also come up in a defence, i.e. after the opponents opened. */
  defence: boolean;
}

/**
 * Names in a system are typed by hand, so "Cue-bid", "cue bid" and "cue-bid" are one convention: case, spaces and punctuation
 * are ignored. The server's `ConventionDealer.Key` applies the very same rule, which is what lets any spelling be sent back.
 */
export function conventionKey(name: string | null | undefined): string {
  return (name ?? '').replace(/[^\p{L}\p{Nd}]/gu, '').toLowerCase();
}

/**
 * Every convention named on a bid the engine can reach, alphabetically, together with where it comes up. A switched-off bid
 * takes everything under it out of play, so its whole branch is left out - a convention found only there could never come up.
 */
export function conventionChoices(system: BiddingSystem | null): ConventionChoice[] {
  const spellings = new Map<string, Map<string, number>>();

  const visit = (nodes: readonly BidNode[] | null | undefined) => {
    for (const node of nodes ?? []) {
      if (node.isDisabled) {
        continue;
      }

      const name = (node.convention ?? '').trim();
      const key = conventionKey(name);
      if (key !== '') {
        const counts = spellings.get(key) ?? new Map<string, number>();
        counts.set(name, (counts.get(name) ?? 0) + 1);
        spellings.set(key, counts);
      }

      visit(node.nextBids);
    }
  };

  for (const root of system?.roots ?? []) {
    visit(root.bids);
  }

  const reach = placesOf(system);

  return [...spellings.entries()]
    .map(([key, counts]) => {
      const ranked = [...counts.entries()].sort((left, right) => right[1] - left[1]);
      const place = reach.get(key);

      return {
        key,
        label: ranked[0][0],
        bids: ranked.reduce((total, [, count]) => total + count, 0),
        openings: place?.openings ?? [],
        defence: place?.defence ?? false,
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label, 'pl'));
}

/**
 * Which openings - and whether the defences - lead to each convention. Walked the way the engine walks the tree: down the
 * bids, and across every continuation, so a convention kept once in a shared branch counts under every opening that jumps there.
 */
function placesOf(system: BiddingSystem | null): Map<string, { openings: OpeningChoice[]; defence: boolean }> {
  const places = new Map<string, { openings: OpeningChoice[]; defence: boolean }>();
  const byId = new Map<string, BidNode>();

  const index = (nodes: readonly BidNode[] | null | undefined) => {
    for (const node of nodes ?? []) {
      if (node.nodeId) {
        byId.set(node.nodeId, node);
      }
      index(node.nextBids);
    }
  };

  for (const root of system?.roots ?? []) {
    index(root.bids);
  }

  /** Every convention key reachable from `start`, the start itself included. */
  const reachable = (start: BidNode): Set<string> => {
    const keys = new Set<string>();
    const seen = new Set<BidNode>();
    const stack = [start];

    while (stack.length > 0) {
      const node = stack.pop() as BidNode;
      if (seen.has(node) || node.isDisabled) {
        continue;
      }

      seen.add(node);

      const key = conventionKey(node.convention);
      if (key !== '') {
        keys.add(key);
      }

      stack.push(...(node.nextBids ?? []));

      const continuation = node.continuationNodeId ? byId.get(node.continuationNodeId) : undefined;
      if (continuation !== undefined) {
        stack.push(...(continuation.nextBids ?? []));
      }
    }

    return keys;
  };

  const placeOf = (key: string) => {
    const place = places.get(key) ?? { openings: [], defence: false };
    places.set(key, place);
    return place;
  };

  for (const opening of openingChoices(system)) {
    const node = byId.get(opening.nodeId);
    for (const key of node === undefined ? [] : reachable(node)) {
      placeOf(key).openings.push(opening);
    }
  }

  const defences = (system?.roots ?? []).find((root) => (root.name ?? '').trim() === defencesRootName);
  for (const node of defences?.bids ?? []) {
    for (const key of reachable(node)) {
      placeOf(key).defence = true;
    }
  }

  return places;
}

/**
 * Where a convention comes up, sorted into the few cases the list tells apart:
 *
 * - `single`: after one opening, which is shown with its meaning;
 * - `variants`: after several variants of one and the same bid - three different 1NT, say - so the bid is shown, not a meaning;
 * - `several`: after different bids, so no single one can be shown;
 * - `defence`: only in the defences;
 * - `unreachable`: no branch of the system leads to it at all, so there is nothing to practise.
 */
export type ConventionPlace =
  | { kind: 'single'; opening: OpeningChoice; defence: boolean }
  | { kind: 'variants'; opening: OpeningChoice; text: string; defence: boolean }
  | { kind: 'several'; text: string; defence: boolean }
  | { kind: 'defence' }
  | { kind: 'unreachable' };

export function placeOf(choice: ConventionChoice): ConventionPlace {
  const [first, ...rest] = choice.openings;

  if (first === undefined) {
    return choice.defence ? { kind: 'defence' } : { kind: 'unreachable' };
  }

  if (rest.length === 0) {
    return { kind: 'single', opening: first, defence: choice.defence };
  }

  const count = choice.openings.length;
  const sameBid = rest.every((opening) => opening.type === first.type && opening.color === first.color && opening.level === first.level);

  return sameBid
    ? { kind: 'variants', opening: first, text: `${count} ${plural(count, 'warianty', 'wariantów')}`, defence: choice.defence }
    : { kind: 'several', text: `${count} ${plural(count, 'otwarcia', 'otwarć')}`, defence: choice.defence };
}

/** Polish plural for a count of two or more: 2-4 take the first form, 5-21 the second, 22-24 the first again. */
function plural(count: number, few: string, many: string): string {
  const ones = count % 10;
  const tens = count % 100;
  return ones >= 2 && ones <= 4 && (tens < 12 || tens > 14) ? few : many;
}
