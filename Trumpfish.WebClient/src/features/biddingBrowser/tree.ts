import { formatBid, hasInterjection, type EditableBidNode, type EditableSystem, type NodePath } from './model';

/**
 * Index standing for the interjection folder, which is drawn by the tree but is not a child of anything.
 *
 * Being a negative index is what keeps it harmless: it can never collide with a real position, and `getNode` returns null for
 * it, so every command that needs an actual bid declines on its own. Only the commands that mean something for a folder -
 * adding into it, and sorting what it holds - check for it explicitly.
 */
export const interjectionFolder = -1;

export function folderPathUnder(container: NodePath): NodePath {
  return { rootIndex: container.rootIndex, path: [...container.path, interjectionFolder] };
}

export function isFolderPath(target: NodePath | null): boolean {
  return target !== null && target.path[target.path.length - 1] === interjectionFolder;
}

/** Children of a container: a root's own bids when the path is empty, otherwise the addressed bid's continuations. */
export function childrenAt(system: EditableSystem, container: NodePath): EditableBidNode[] {
  return container.path.length === 0 ? system.roots[container.rootIndex]?.bids ?? [] : getNode(system, container)?.nextBids ?? [];
}

/** Length of the leading run of interjected bids, which is exactly what the folder holds. */
export function interjectedCount(children: readonly EditableBidNode[]): number {
  let count = 0;
  while (count < children.length && hasInterjection(children[count])) {
    count += 1;
  }

  return count;
}

/** True when the selection sits on, or below, one of the bids the folder under `container` is holding. */
export function holdsInterjected(container: NodePath, selection: NodePath | null, count: number): boolean {
  if (selection === null || selection.rootIndex !== container.rootIndex || selection.path.length <= container.path.length) {
    return false;
  }

  if (!container.path.every((value, index) => value === selection.path[index])) {
    return false;
  }

  const next = selection.path[container.path.length];
  return next >= 0 && next < count;
}

type NodeUpdater = (node: EditableBidNode) => EditableBidNode | null;
type ChildrenUpdater = (children: EditableBidNode[]) => EditableBidNode[];

export function samePath(left: NodePath | null, right: NodePath | null): boolean {
  if (left === null || right === null) {
    return left === right;
  }

  return left.rootIndex === right.rootIndex && left.path.length === right.path.length && left.path.every((value, index) => value === right.path[index]);
}

export function getNode(system: EditableSystem, target: NodePath | null): EditableBidNode | null {
  if (target === null || target.path.length === 0) {
    return null;
  }

  let nodes = system.roots[target.rootIndex]?.bids ?? [];
  let node: EditableBidNode | undefined;

  for (const index of target.path) {
    node = nodes[index];
    if (node === undefined) {
      return null;
    }
    nodes = node.nextBids;
  }

  return node ?? null;
}

/** Bids said before the selected one, ordered from the root down to its parent; empty when the selection sits at the top level. */
export function ancestorNodes(system: EditableSystem, target: NodePath | null): EditableBidNode[] {
  const ancestors: EditableBidNode[] = [];
  if (target === null) {
    return ancestors;
  }

  let nodes = system.roots[target.rootIndex]?.bids ?? [];

  for (const index of target.path.slice(0, -1)) {
    const node = nodes[index];
    if (node === undefined) {
      return ancestors;
    }

    ancestors.push(node);
    nodes = node.nextBids;
  }

  return ancestors;
}

/** Applies `updater` to the node addressed by `path`; returning `null` from the updater removes the node. */
function replaceAt(nodes: EditableBidNode[], path: number[], updater: NodeUpdater): EditableBidNode[] {
  const [index, ...rest] = path;
  const node = nodes[index];
  if (node === undefined) {
    return nodes;
  }

  if (rest.length === 0) {
    const updated = updater(node);
    return updated === null ? [...nodes.slice(0, index), ...nodes.slice(index + 1)] : [...nodes.slice(0, index), updated, ...nodes.slice(index + 1)];
  }

  return [...nodes.slice(0, index), { ...node, nextBids: replaceAt(node.nextBids, rest, updater) }, ...nodes.slice(index + 1)];
}

export function updateNodeAt(system: EditableSystem, target: NodePath, updater: NodeUpdater): EditableSystem {
  if (target.path.length === 0) {
    return system;
  }

  return withRootBids(system, target.rootIndex, (bids) => replaceAt(bids, target.path, updater));
}

/** `target` addresses the container whose children are rewritten: an empty path means the root's own bid list. */
export function updateChildrenAt(system: EditableSystem, target: NodePath, updater: ChildrenUpdater): EditableSystem {
  if (target.path.length === 0) {
    return withRootBids(system, target.rootIndex, updater);
  }

  return withRootBids(system, target.rootIndex, (bids) => replaceAt(bids, target.path, (node) => ({ ...node, nextBids: updater(node.nextBids) })));
}

function withRootBids(system: EditableSystem, rootIndex: number, updater: ChildrenUpdater): EditableSystem {
  const root = system.roots[rootIndex];
  if (root === undefined) {
    return system;
  }

  const roots = [...system.roots];
  roots[rootIndex] = { ...root, bids: updater(root.bids) };
  return { ...system, roots };
}

export function parentPath(target: NodePath): NodePath {
  return { rootIndex: target.rootIndex, path: target.path.slice(0, -1) };
}

/** True when `candidate` sits strictly below `container` in the same root. */
export function containsPath(container: NodePath, candidate: NodePath | null): boolean {
  if (candidate === null || container.rootIndex !== candidate.rootIndex || container.path.length >= candidate.path.length) {
    return false;
  }

  return container.path.every((value, index) => value === candidate.path[index]);
}

/**
 * Turns a `ValidationIssue.path` such as `Otwarcia > 1♣ > 1♥` back into a tree address, matching every segment against the
 * label produced by `formatBid` - the same format the server writes.
 *
 * Either the whole path is found or nothing is: settling for the deepest ancestor that still matched would answer a question
 * nobody asked, and a bid deleted since the run would send the caller off to its parent as if that were the one meant.
 */
export function resolveIssuePath(system: EditableSystem, issuePath: string | null | undefined): NodePath | null {
  const segments = (issuePath ?? '').split('>').map((segment) => segment.trim()).filter((segment) => segment.length > 0);
  if (segments.length < 2) {
    return null;
  }

  const [rootName, ...bidLabels] = segments;
  const rootIndex = system.roots.findIndex((root) => (root.name ?? '').trim() === rootName || (rootName === '<root>' && (root.name ?? '').trim() === ''));
  if (rootIndex < 0) {
    return null;
  }

  const path = matchLabels(system.roots[rootIndex].bids, bidLabels);
  return path === null ? null : { rootIndex, path };
}

/**
 * Walks the labels down the tree. Siblings can carry the same label - an interjected 1♥ and a plain one, say - so a match that
 * leads nowhere is abandoned rather than accepted: only a branch spelling out every remaining label is the one meant.
 */
function matchLabels(nodes: EditableBidNode[], labels: string[]): number[] | null {
  if (labels.length === 0) {
    return [];
  }

  const [label, ...rest] = labels;

  for (let index = 0; index < nodes.length; index++) {
    if (formatBid(nodes[index]) !== label) {
      continue;
    }

    const found = matchLabels(nodes[index].nextBids, rest);
    if (found !== null) {
      return [index, ...found];
    }
  }

  return null;
}

/**
 * Locates the bid carrying `nodeId`. This is the precise counterpart of {@link resolveIssuePath}, which can only match on
 * labels and therefore picks the first of several identically named branches.
 */
export function findNodeById(system: EditableSystem, nodeId: string | null | undefined): NodePath | null {
  if (nodeId === null || nodeId === undefined || nodeId.length === 0) {
    return null;
  }

  const search = (nodes: EditableBidNode[], path: number[]): number[] | null => {
    for (let index = 0; index < nodes.length; index++) {
      const candidate = [...path, index];
      if (nodes[index].nodeId === nodeId) {
        return candidate;
      }

      const found = search(nodes[index].nextBids, candidate);
      if (found !== null) {
        return found;
      }
    }

    return null;
  };

  for (let rootIndex = 0; rootIndex < system.roots.length; rootIndex++) {
    const path = search(system.roots[rootIndex].bids, []);
    if (path !== null) {
      return { rootIndex, path };
    }
  }

  return null;
}

export function childPath(target: NodePath, index: number): NodePath {
  return { rootIndex: target.rootIndex, path: [...target.path, index] };
}

export function countBids(system: EditableSystem): number {
  const count = (nodes: EditableBidNode[]): number => nodes.reduce((total, node) => total + 1 + count(node.nextBids), 0);
  return system.roots.reduce((total, root) => total + count(root.bids), 0);
}
