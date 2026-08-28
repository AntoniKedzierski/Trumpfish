import type { BidColor } from '@/api/models';
import { colorMark, type EditableBidNode, type InterjectionBid } from './model';

export type InterjectionOptionKind = 'submit' | 'double' | 'clear' | 'empty';

export interface InterjectionOption {
  kind: InterjectionOptionKind;
  /** Bid represented by the cell; `null` for the clear and filler cells. */
  bid: InterjectionBid | null;
  /** False when bridge rules forbid the opponent from making this bid at this point of the sequence. */
  available: boolean;
}

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

  const candidateValue = candidate.value ?? 0;
  const currentValue = current.value ?? 0;
  return candidateValue > currentValue || (candidateValue === currentValue && colorRank(candidate.color) > colorRank(current.color));
}

/**
 * Highest `Submit` bid made before the interjection, i.e. anywhere on the path down to (and including) the parent bid,
 * counting the interjections of the ancestors as well - they are part of the same auction.
 */
export function highestBidBefore(ancestors: readonly EditableBidNode[]): InterjectionBid | null {
  let highest: InterjectionBid | null = null;

  for (const ancestor of ancestors) {
    for (const candidate of [toInterjectionBid(ancestor), ancestor.interjection ?? null]) {
      if (candidate !== null && candidate.type === 'Submit' && outbids(candidate, highest)) {
        highest = candidate;
      }
    }
  }

  return highest;
}

function toInterjectionBid(node: EditableBidNode): InterjectionBid {
  return { type: node.type ?? 'Submit', color: node.color ?? 'NoColor', value: typeof node.value === 'number' ? node.value : Number(node.value ?? 0) };
}

/** A `Submit` interjection is legal only when it outbids everything said earlier in the sequence. */
export function canInterjectSubmit(ancestors: readonly EditableBidNode[], value: number, color: BidColor): boolean {
  return outbids({ type: 'Submit', color, value }, highestBidBefore(ancestors));
}

/** A `Double` interjection is legal only when the directly preceding bid - the parent one - is a `Submit`. */
export function canInterjectDouble(ancestors: readonly EditableBidNode[]): boolean {
  return ancestors[ancestors.length - 1]?.type === 'Submit';
}

/** Builds the 8 x 5 grid of the picker: seven rows of levels, then a row holding the double and the clear button. */
export function interjectionOptions(ancestors: readonly EditableBidNode[]): InterjectionOption[] {
  const options: InterjectionOption[] = [];

  for (const value of pickerLevels) {
    for (const color of pickerColors) {
      options.push({ kind: 'submit', bid: { type: 'Submit', color, value }, available: canInterjectSubmit(ancestors, value, color) });
    }
  }

  options.push({ kind: 'double', bid: { type: 'Double', color: 'NoColor', value: null }, available: canInterjectDouble(ancestors) });
  options.push({ kind: 'empty', bid: null, available: false });
  options.push({ kind: 'empty', bid: null, available: false });
  options.push({ kind: 'empty', bid: null, available: false });
  options.push({ kind: 'clear', bid: null, available: true });

  return options;
}

export function formatInterjection(bid: InterjectionBid): string {
  return bid.type === 'Double' ? 'X' : `${bid.value ?? ''}${colorMark(bid.color)}`;
}
