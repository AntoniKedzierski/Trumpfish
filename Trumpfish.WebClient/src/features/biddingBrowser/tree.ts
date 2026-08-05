import type { EditableBidNode, EditableSystem, NodePath } from './model';

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

export function childPath(target: NodePath, index: number): NodePath {
  return { rootIndex: target.rootIndex, path: [...target.path, index] };
}

export function countBids(system: EditableSystem): number {
  const count = (nodes: EditableBidNode[]): number => nodes.reduce((total, node) => total + 1 + count(node.nextBids), 0);
  return system.roots.reduce((total, root) => total + count(root.bids), 0);
}
