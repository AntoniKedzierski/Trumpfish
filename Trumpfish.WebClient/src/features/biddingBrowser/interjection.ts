import type { BidColor } from '@/api/models';
import { toNumber } from '@/api/models';
import type { EditableBidNode, InterjectionBid } from './model';

export type InterjectionOptionKind = 'submit' | 'double' | 'clear' | 'empty';

export interface InterjectionOption {
  kind: InterjectionOptionKind;
  /** Bid represented by the cell; `null` for the clear and filler cells. */
  bid: InterjectionBid | null;
  /** False when bridge rules forbid the opponent from making this bid at this point of the sequence. */
  available: boolean;
}

/** The bid an interjection is chosen for - only what it is matters here, not what it means. */
export type InterjectedCall = Pick<EditableBidNode, 'type' | 'color' | 'value'>;

/** Popup columns, ordered the same way the suits rank: ♣ < ♦ < ♥ < ♠ < NT. */
const pickerColors: readonly BidColor[] = ['Clubs', 'Diamonds', 'Hearts', 'Spades', 'NoTrump'];

const pickerLevels: readonly number[] = [1, 2, 3, 4, 5, 6, 7];

function colorRank(color: BidColor | undefined): number {
  const index = pickerColors.indexOf(color ?? 'NoColor');
  return index < 0 ? -1 : index;
}

function outbids(candidate: InterjectionBid, current: InterjectionBid | null): boolean {
  if (current === null) {
    return true;
  }

  const candidateValue = toNumber(candidate.value) ?? 0;
  const currentValue = toNumber(current.value) ?? 0;
  return candidateValue > currentValue || (candidateValue === currentValue && colorRank(candidate.color) > colorRank(current.color));
}

/**
 * Highest `Submit` bid made before the interjection, i.e. anywhere on the path down to (and including) the parent bid,
 * counting the interjections of the ancestors as well - they are part of the same auction.
 */
/*
 * An ancestor with several interjections stands for several auctions; its lowest one is taken, so a cell stays open as long
 * as at least one of those auctions allows it.
 */
export function highestBidBefore(ancestors: readonly EditableBidNode[]): InterjectionBid | null {
  let highest: InterjectionBid | null = null;

  for (const ancestor of ancestors) {
    const lowestInterjection = ancestor.interjections.find((interjection) => interjection.type === 'Submit') ?? null;
    for (const candidate of [toInterjectionBid(ancestor), lowestInterjection]) {
      if (candidate !== null && candidate.type === 'Submit' && outbids(candidate, highest)) {
        highest = candidate;
      }
    }
  }

  return highest;
}

function toInterjectionBid(node: InterjectedCall): InterjectionBid {
  return { type: node.type ?? 'Submit', color: node.color ?? 'NoColor', value: toNumber(node.value) ?? 0 };
}

/**
 * A `Submit` interjection sits between two bounds: it outbids everything said earlier in the sequence, and the bid it is chosen
 * for still has to be legal after it - a bid above it, a double of it, or a pass. A redouble needs a double before it.
 */
export function canInterjectSubmit(ancestors: readonly EditableBidNode[], call: InterjectedCall, value: number, color: BidColor): boolean {
  const interjection: InterjectionBid = { type: 'Submit', color, value };
  if (!outbids(interjection, highestBidBefore(ancestors))) {
    return false;
  }

  switch (call.type ?? 'Submit') {
    case 'Submit':
      return outbids(toInterjectionBid(call), interjection);
    case 'Redouble':
      return false;
    default:
      return true;
  }
}

/**
 * A `Double` interjection is legal only when the directly preceding bid - the parent one - is a `Submit`, and the bid it is
 * chosen for is not a double itself: a double cannot be doubled again, only redoubled.
 */
export function canInterjectDouble(ancestors: readonly EditableBidNode[], call: InterjectedCall): boolean {
  return ancestors[ancestors.length - 1]?.type === 'Submit' && call.type !== 'Double';
}

/** Whether `interjection` is still legal for `call` - an already chosen one can stop being so when the bid itself changes. */
export function isInterjectionLegal(ancestors: readonly EditableBidNode[], call: InterjectedCall, interjection: InterjectionBid): boolean {
  return interjection.type === 'Double'
    ? canInterjectDouble(ancestors, call)
    : canInterjectSubmit(ancestors, call, toNumber(interjection.value) ?? 0, interjection.color ?? 'NoColor');
}

/** Builds the 8 x 5 grid of the picker: seven rows of levels, then a row holding the double and the clear button. */
export function interjectionOptions(ancestors: readonly EditableBidNode[], call: InterjectedCall): InterjectionOption[] {
  const options: InterjectionOption[] = [];

  for (const value of pickerLevels) {
    for (const color of pickerColors) {
      options.push({ kind: 'submit', bid: { type: 'Submit', color, value }, available: canInterjectSubmit(ancestors, call, value, color) });
    }
  }

  options.push({ kind: 'double', bid: { type: 'Double', color: 'NoColor', value: null }, available: canInterjectDouble(ancestors, call) });
  options.push({ kind: 'empty', bid: null, available: false });
  options.push({ kind: 'empty', bid: null, available: false });
  options.push({ kind: 'empty', bid: null, available: false });
  options.push({ kind: 'clear', bid: null, available: true });

  return options;
}
