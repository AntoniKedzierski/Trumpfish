import { contradictsPromised, narrowInto, type InheritedRanges } from './constraints';
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
}

/**
 * Removes the bids that can never be reached from the subtree under `target`: the ones whose points or suit lengths have no
 * overlap with what the same player already promised higher up the sequence.
 *
 * The bid holding the subtree is kept whatever it says - it is the ground being cleaned, not part of the cleaning - and a bid
 * that goes takes its own continuations with it, since they were only reachable through it.
 */
export function removeUnreachable(system: EditableSystem, target: NodePath | null): CleanupResult {
  if (target === null) {
    return system.roots.reduce<CleanupResult>(
      (result, _root, rootIndex) => {
        const cleaned = removeUnreachable(result.system, { rootIndex, path: [] });
        return { system: cleaned.system, removed: result.removed + cleaned.removed };
      },
      { system, removed: 0 },
    );
  }

  // The folder is drawn over part of a list rather than owning one, so cleaning it means cleaning the list it is drawn over.
  const container = isFolderPath(target) ? parentPath(target) : target;
  const { children, removed } = prune(childrenAt(system, container), promisedAt(system, container));

  return removed === 0 ? { system, removed: 0 } : { system: updateChildrenAt(system, container, () => children), removed };
}

function prune(children: EditableBidNode[], promised: Promised): { children: EditableBidNode[]; removed: number } {
  const kept: EditableBidNode[] = [];
  let removed = 0;

  for (const node of children) {
    const speaker = node.openerBid === true ? 'opener' : 'responder';

    if (contradictsPromised(promised[speaker], node)) {
      removed += 1 + countBelow(node);
      continue;
    }

    const below = prune(node.nextBids, { ...promised, [speaker]: narrowInto(promised[speaker], node) });
    removed += below.removed;
    kept.push({ ...node, nextBids: below.children });
  }

  return { children: kept, removed };
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
