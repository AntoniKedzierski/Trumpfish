import { toNumber, type NumberRange } from '@/api/models';
import { contradictsPromised, narrowInto, rangeFields, type InheritedRanges } from './constraints';
import type { EditableBidNode, EditableSystem, NodePath } from './model';
import { childrenAt, isFolderPath, parentPath, updateChildrenAt } from './tree';

/**
 * What each of the two players has promised so far. The tree alternates between them, so a bid is constrained by its ancestors
 * of the same side only - the opponent's holdings say nothing about its own hand.
 */
interface Promised {
  opener: InheritedRanges;
  responder: InheritedRanges;
}

export interface CleanupResult {
  system: EditableSystem;
  /** Bids dropped, counting everything that hung below them. */
  removed: number;
  /** Upper bounds cleared because they sat above what the speaker had already promised and so narrowed nothing. */
  relaxed: number;
}

/**
 * Tidies the subtree under `target` against what each player has already promised. Two things happen to a bid:
 *
 * - an upper bound sitting above the promised one narrows nothing, so it is cleared rather than left to mislead;
 * - a bid whose ranges have no overlap at all with the promise can never be said, so it goes, and its continuations with it -
 *   they were only reachable through it.
 *
 * Lower bounds are left exactly as written: restating a floor the sequence already guarantees is idiomatic, not an error.
 * The bid holding the subtree is kept whatever it says - it is the ground being cleaned, not part of the cleaning.
 */
export function removeUnreachable(system: EditableSystem, target: NodePath | null): CleanupResult {
  if (target === null) {
    return system.roots.reduce<CleanupResult>(
      (result, _root, rootIndex) => {
        const cleaned = removeUnreachable(result.system, { rootIndex, path: [] });
        return { system: cleaned.system, removed: result.removed + cleaned.removed, relaxed: result.relaxed + cleaned.relaxed };
      },
      { system, removed: 0, relaxed: 0 },
    );
  }

  // The folder is drawn over part of a list rather than owning one, so cleaning it means cleaning the list it is drawn over.
  const container = isFolderPath(target) ? parentPath(target) : target;
  const { children, removed, relaxed } = prune(childrenAt(system, container), promisedAt(system, container));

  if (removed === 0 && relaxed === 0) {
    return { system, removed: 0, relaxed: 0 };
  }

  return { system: updateChildrenAt(system, container, () => children), removed, relaxed };
}

function prune(children: EditableBidNode[], promised: Promised): { children: EditableBidNode[]; removed: number; relaxed: number } {
  const kept: EditableBidNode[] = [];
  let removed = 0;
  let relaxed = 0;

  for (const node of children) {
    const speaker = node.openerBid === true ? 'opener' : 'responder';
    const promisedHere = promised[speaker];

    // Tidying first: dropping a bound that never bit cannot turn a reachable bid into an unreachable one, or the other way.
    const tidied = dropLooseUpperBounds(promisedHere, node);
    relaxed += tidied.cleared;

    if (contradictsPromised(promisedHere, tidied.node)) {
      removed += 1 + countBelow(node);
      continue;
    }

    const below = prune(tidied.node.nextBids, { ...promised, [speaker]: narrowInto(promisedHere, tidied.node) });
    removed += below.removed;
    relaxed += below.relaxed;
    kept.push({ ...tidied.node, nextBids: below.children });
  }

  return { children: kept, removed, relaxed };
}

/**
 * Clears the upper bounds that sit above the promised ones. A bid saying 12-17 under a promised 12-14 is not wrong - it is
 * simply reachable only up to 14 - so the 17 is noise, and the field is better left empty where the editor shows the real
 * ceiling as a placeholder. A bound equal to the promised one is left alone: it restates the truth rather than obscuring it.
 */
function dropLooseUpperBounds(promised: InheritedRanges, node: EditableBidNode): { node: EditableBidNode; cleared: number } {
  let result = node;
  let cleared = 0;

  for (const field of rangeFields) {
    const ceiling = promised[field]?.upper;
    const range = node[field] as NumberRange | null | undefined;
    const upper = toNumber(range?.upper);

    if (ceiling === null || ceiling === undefined || upper === null || upper <= ceiling) {
      continue;
    }

    const lower = toNumber(range?.lower);
    cleared += 1;
    result = { ...result, [field]: lower === null ? null : { ...range, upper: null } };
  }

  return { node: result, cleared };
}

/** What the two players have promised by the time the auction reaches `container`. */
function promisedAt(system: EditableSystem, container: NodePath): Promised {
  const promised: Promised = { opener: {}, responder: {} };
  let nodes = system.roots[container.rootIndex]?.bids ?? [];

  for (const index of container.path) {
    const node = nodes[index];
    if (node === undefined) {
      break;
    }

    const speaker = node.openerBid === true ? 'opener' : 'responder';
    promised[speaker] = narrowInto(promised[speaker], node);
    nodes = node.nextBids;
  }

  return promised;
}

function countBelow(node: EditableBidNode): number {
  return node.nextBids.reduce((total, child) => total + 1 + countBelow(child), 0);
}
