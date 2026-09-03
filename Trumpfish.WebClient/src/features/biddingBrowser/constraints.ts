import { toNumber, type NumberRange } from '@/api/models';
import type { EditableBidNode, EditableSystem, NodePath } from './model';

export type RangeField = 'pointsRange' | 'clubsCardRange' | 'diamondsCardRange' | 'heartsCardRange' | 'spadesCardRange';

export interface InheritedRange {
  lower: number | null;
  upper: number | null;
}

/** Ranges already promised by the selected player on the way down to the current node, one entry per editable range field. */
export type InheritedRanges = Partial<Record<RangeField, InheritedRange>>;

export const rangeFields: readonly RangeField[] = ['pointsRange', 'clubsCardRange', 'diamondsCardRange', 'heartsCardRange', 'spadesCardRange'];

/**
 * Walks from the root down to `target` and intersects the ranges declared by the ancestors that belong to the same speaker
 * (the tree alternates opener/responder, so `openerBid` identifies the player). The node itself is excluded - its own values
 * are what the editor is about to compare against.
 */
export function inheritedRanges(system: EditableSystem, target: NodePath | null): InheritedRanges {
  const inherited: InheritedRanges = {};
  if (target === null || target.path.length === 0) {
    return inherited;
  }

  const ancestors: EditableBidNode[] = [];
  let nodes = system.roots[target.rootIndex]?.bids ?? [];

  for (const index of target.path) {
    const node = nodes[index];
    if (node === undefined) {
      return inherited;
    }

    ancestors.push(node);
    nodes = node.nextBids;
  }

  const current = ancestors.pop();
  if (current === undefined) {
    return inherited;
  }

  for (const ancestor of ancestors) {
    if (Boolean(ancestor.openerBid) !== Boolean(current.openerBid)) {
      continue;
    }

    for (const field of rangeFields) {
      inherited[field] = narrow(inherited[field], ancestor[field] as NumberRange | null | undefined);
    }
  }

  return inherited;
}

function narrow(accumulated: InheritedRange | undefined, range: NumberRange | null | undefined): InheritedRange | undefined {
  const lower = toNumber(range?.lower);
  const upper = toNumber(range?.upper);
  if (lower === null && upper === null) {
    return accumulated;
  }

  const previous = accumulated ?? { lower: null, upper: null };
  return {
    lower: previous.lower === null ? lower : lower === null ? previous.lower : Math.max(previous.lower, lower),
    upper: previous.upper === null ? upper : upper === null ? previous.upper : Math.min(previous.upper, upper),
  };
}

/** Folds the ranges a bid declares into the window its speaker has already promised, giving the window that holds below it. */
export function narrowInto(promised: InheritedRanges, node: EditableBidNode): InheritedRanges {
  const next: InheritedRanges = { ...promised };
  for (const field of rangeFields) {
    next[field] = narrow(promised[field], node[field] as NumberRange | null | undefined);
  }

  return next;
}

/**
 * Whether a bid can never be said: one of its ranges has nothing in common with what its speaker already promised.
 *
 * This is emptiness of the intersection, not merely being outside the promised window. A bid that restates a wider range than
 * the sequence allows is sloppy - the editor already outlines it - but it is still reachable, and must survive a cleanup.
 */
export function contradictsPromised(promised: InheritedRanges, node: EditableBidNode): boolean {
  return rangeFields.some((field) => {
    const merged = narrow(promised[field], node[field] as NumberRange | null | undefined);
    return merged !== undefined && merged.lower !== null && merged.upper !== null && merged.lower > merged.upper;
  });
}

/** Renders the inherited range as a greyed out placeholder such as `14` / `17`; `null` means there is nothing to hint. */
export function placeholderFor(inherited: InheritedRange | undefined, bound: keyof NumberRange): string | undefined {
  const value = inherited?.[bound];
  return value === null || value === undefined ? undefined : String(value);
}

/**
 * A bid can only narrow what the player already promised, so anything outside the inherited window - or an inverted pair -
 * is reported as a conflict and the offending textbox gets a red outline.
 */
export function conflicts(inherited: InheritedRange | undefined, range: NumberRange | null | undefined, bound: keyof NumberRange): boolean {
  const value = toNumber(range?.[bound]);
  if (value === null) {
    return false;
  }

  const lower = toNumber(range?.lower);
  const upper = toNumber(range?.upper);
  if (lower !== null && upper !== null && lower > upper) {
    return true;
  }

  if (inherited === undefined) {
    return false;
  }

  return (inherited.lower !== null && value < inherited.lower) || (inherited.upper !== null && value > inherited.upper);
}
