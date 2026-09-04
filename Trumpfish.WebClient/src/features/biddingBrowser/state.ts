import { toNumber, type BidColor, type ValidationIssue } from '@/api/models';
import { interjectionOptions } from './interjection';
import { cloneNode, compareBids, compareWithInterjection, createBidNode, createEmptySystem, hasInterjection, type EditableBidNode, type EditableSystem, type InterjectionBid, type NodePath } from './model';
import { childPath, childrenAt, getNode, interjectedCount, isFolderPath, parentPath, samePath, updateChildrenAt, updateNodeAt } from './tree';

const suitLadder: readonly BidColor[] = ['Clubs', 'Diamonds', 'Hearts', 'Spades', 'NoTrump'];

export interface BrowserState {
  system: EditableSystem;
  /** Id of the stored system being edited, or null for one that has never been saved. Saving decides create versus update on it. */
  systemId: string | null;
  selection: NodePath | null;
  /** Always a list, so copying one bid and copying a whole set of children paste through exactly the same path. */
  clipboard: EditableBidNode[] | null;
  issues: ValidationIssue[] | null;
  dirty: boolean;
}

export type BrowserAction =
  | { kind: 'loadSystem'; system: EditableSystem; systemId: string | null }
  | { kind: 'setSystemName'; name: string }
  | { kind: 'select'; target: NodePath | null }
  | { kind: 'addBid' }
  | { kind: 'addSibling' }
  | { kind: 'duplicate' }
  | { kind: 'cut' }
  | { kind: 'deleteBid' }
  | { kind: 'moveUp' }
  | { kind: 'moveDown' }
  | { kind: 'updateNode'; patch: Partial<EditableBidNode> }
  | { kind: 'copy' }
  | { kind: 'copyChildren' }
  | { kind: 'cutChildren' }
  | { kind: 'paste' }
  | { kind: 'sort' }
  | { kind: 'replaceSystem'; system: EditableSystem }
  | { kind: 'setIssues'; issues: ValidationIssue[] | null }
  | { kind: 'markSaved'; systemId: string };

export const initialBrowserState: BrowserState = { system: createEmptySystem(), systemId: null, selection: null, clipboard: null, issues: null, dirty: false };

export function browserReducer(state: BrowserState, action: BrowserAction): BrowserState {
  switch (action.kind) {
    case 'loadSystem':
      return { ...initialBrowserState, system: action.system, systemId: action.systemId, clipboard: state.clipboard };

    case 'setSystemName':
      return { ...state, system: { ...state.system, systemName: action.name }, dirty: true };

    case 'select':
      return { ...state, selection: action.target };

    case 'addBid':
      return addBid(state);

    case 'addSibling':
      return addSibling(state);

    case 'duplicate':
      return duplicate(state);

    case 'cut': {
      const node = getNode(state.system, state.selection);
      return node === null ? state : deleteBid({ ...state, clipboard: [cloneNode(node)] });
    }

    case 'deleteBid':
      return deleteBid(state);

    case 'moveUp':
      return moveBy(state, -1);

    case 'moveDown':
      return moveBy(state, 1);

    case 'updateNode':
      return updateSelected(state, action.patch);

    case 'copy': {
      const node = getNode(state.system, state.selection);
      return node === null ? state : { ...state, clipboard: [cloneNode(node)] };
    }

    case 'copyChildren': {
      const children = selectedChildren(state);
      return children.length === 0 ? state : { ...state, clipboard: children.map(cloneNode) };
    }

    case 'cutChildren':
      return cutChildren(state);

    case 'paste':
      return paste(state);

    case 'sort':
      return sort(state);

    // A tree rewritten wholesale outside the reducer. The selection survives because every such rewrite only ever removes
    // things below what is selected, never the selected bid itself.
    case 'replaceSystem':
      return { ...state, system: action.system, dirty: true };

    case 'setIssues':
      return { ...state, issues: action.issues };

    case 'markSaved':
      return { ...state, systemId: action.systemId, dirty: false };
  }
}

function addBid(state: BrowserState): BrowserState {
  if (state.selection === null) {
    return state;
  }

  // The folder stands for the interjected bids of the container it sits in, so adding under it adds one more of those.
  if (isFolderPath(state.selection)) {
    return addInterjected(state, parentPath(state.selection));
  }

  const parent = getNode(state.system, state.selection);
  const siblings = parent === null ? state.system.roots[state.selection.rootIndex]?.bids ?? [] : parent.nextBids;

  // With siblings around we continue after the last one, otherwise the first child continues after the parent bid itself.
  const { color, value } = bidAfter(siblings.length === 0 ? parent ?? undefined : siblings[siblings.length - 1]);

  // Mirrors the WPF behaviour: a child always speaks for the other player than its parent, root level bids belong to the opener.
  const child = createBidNode(color, value, parent === null ? true : !parent.openerBid);
  const system = updateChildrenAt(state.system, state.selection, (children) => [...children, child]);

  return { ...state, system, selection: childPath(state.selection, siblings.length), dirty: true };
}

/**
 * Adds a bid beside the selected one instead of under it, which is how a level of the auction is continued. A root has no
 * parent to hang a sibling from, so the selection has to be an actual bid.
 */
function addSibling(state: BrowserState): BrowserState {
  const selected = getNode(state.system, state.selection);
  if (state.selection === null || selected === null) {
    return state;
  }

  // The new bid follows the selected one along the ladder and speaks for the same player, being on the same level.
  const { color, value } = bidAfter(selected);
  const sibling = createBidNode(color, value, selected.openerBid ?? false);

  // Staying beside a bid means staying on the same side of the folder boundary, so the interjection comes along.
  return insertAfter(state, state.selection, selected.interjection ? { ...sibling, interjection: selected.interjection } : sibling);
}


/**
 * Adds a bid into the interjection folder. It goes into the same list as the folder's siblings, carrying the lowest
 * interjection the auction still allows - which is precisely what puts it inside the folder.
 */
function addInterjected(state: BrowserState, container: NodePath): BrowserState {
  const parent = getNode(state.system, container);
  const children = childrenAt(state.system, container);
  const count = interjectedCount(children);

  const { color, value } = bidAfter(children[count - 1] ?? parent ?? undefined);
  const node: EditableBidNode = {
    ...createBidNode(color, value, parent === null ? true : !parent.openerBid),
    interjection: firstLegalInterjection(chainTo(state.system, container)),
  };

  const system = updateChildrenAt(state.system, container, (current) => place(current, node));
  return { ...state, system, selection: childPath(container, count), dirty: true };
}


/** The lowest interjection bridge still permits at this point, taken in the order the picker offers them. */
function firstLegalInterjection(ancestors: readonly EditableBidNode[]): InterjectionBid | null {
  return interjectionOptions(ancestors).find((option) => option.available && option.bid !== null)?.bid ?? null;
}


/** Bids from the root down to and including `container`, which is what decides whether an interjection is legal. */
function chainTo(system: EditableSystem, container: NodePath): EditableBidNode[] {
  const chain: EditableBidNode[] = [];
  let nodes = system.roots[container.rootIndex]?.bids ?? [];

  for (const index of container.path) {
    const node = nodes[index];
    if (node === undefined) {
      break;
    }

    chain.push(node);
    nodes = node.nextBids;
  }

  return chain;
}


/** Inserts a bid on the correct side of the folder boundary: interjected ones close the leading run, the rest go last. */
function place(children: EditableBidNode[], node: EditableBidNode): EditableBidNode[] {
  const at = hasInterjection(node) ? interjectedCount(children) : children.length;
  return [...children.slice(0, at), node, ...children.slice(at)];
}

function duplicate(state: BrowserState): BrowserState {
  const selected = getNode(state.system, state.selection);
  if (state.selection === null || selected === null) {
    return state;
  }

  // cloneNode reissues every identity in the subtree, so the copy never shares a nodeId with the original.
  return insertAfter(state, state.selection, cloneNode(selected));
}

/** Places `node` directly after the selected bid, under the same parent, and moves the selection onto it. */
function insertAfter(state: BrowserState, selection: NodePath, node: EditableBidNode): BrowserState {
  const container = parentPath(selection);
  const index = selection.path[selection.path.length - 1];
  const system = updateChildrenAt(state.system, container, (children) => [...children.slice(0, index + 1), node, ...children.slice(index + 1)]);

  return { ...state, system, selection: childPath(container, index + 1), dirty: true };
}

/** Continues the previous sibling along the ladder (♣ → ♦ → ♥ → ♠ → NT, then NT rolls over to ♣ one level higher); anything else starts a blank bid. */
function bidAfter(previous: EditableBidNode | undefined): { color: BidColor | undefined; value: number | undefined } {
  const index = previous?.type === 'Submit' ? suitLadder.indexOf(previous.color ?? 'NoColor') : -1;
  if (index < 0) {
    return { color: undefined, value: undefined };
  }

  const level = toNumber(previous?.value) ?? 1;
  return index === suitLadder.length - 1 ? { color: 'Clubs', value: level + 1 } : { color: suitLadder[index + 1], value: level };
}

function deleteBid(state: BrowserState): BrowserState {
  // The folder is not a bid and cannot be deleted; it disappears by itself once nothing under the parent is interjected.
  if (state.selection === null || state.selection.path.length === 0 || isFolderPath(state.selection)) {
    return state;
  }

  const container = parentPath(state.selection);
  const index = state.selection.path[state.selection.path.length - 1];
  const system = updateNodeAt(state.system, state.selection, () => null);

  // The selection stays on the level the bid was deleted from: on the bid that took its place, or on the last one when the list
  // ends there. Only an emptied list sends it up to the parent - which by then is a leaf, so nothing folds away with it.
  const remaining = childrenAt(system, container);
  const selection = remaining.length === 0 ? container : childPath(container, Math.min(index, remaining.length - 1));

  return { ...state, system, selection, dirty: true };
}

function moveBy(state: BrowserState, offset: number): BrowserState {
  if (state.selection === null || state.selection.path.length === 0 || isFolderPath(state.selection)) {
    return state;
  }

  const container = parentPath(state.selection);
  const index = state.selection.path[state.selection.path.length - 1];
  const children = childrenAt(state.system, container);
  const count = interjectedCount(children);

  // Belonging to the folder follows from the interjection, so an arrow reorders within a group but never across the boundary.
  const [first, last] = index < count ? [0, count - 1] : [count, children.length - 1];
  const target = index + offset;
  if (target < first || target > last) {
    return state;
  }

  const reordered = [...children];
  const [node] = reordered.splice(index, 1);
  reordered.splice(target, 0, node);

  return { ...state, system: updateChildrenAt(state.system, container, () => reordered), selection: childPath(container, target), dirty: true };
}

function updateSelected(state: BrowserState, patch: Partial<EditableBidNode>): BrowserState {
  if (state.selection === null || state.selection.path.length === 0 || isFolderPath(state.selection)) {
    return state;
  }

  const before = getNode(state.system, state.selection);
  const system = updateNodeAt(state.system, state.selection, (node) => ({ ...node, ...patch }));
  if (before === null || !('interjection' in patch) || hasInterjection(before) === hasInterjection({ ...before, ...patch })) {
    return { ...state, system, dirty: true };
  }

  // Gaining an interjection moves the bid into the folder; losing one drops it to the end of the plain bids below the folder.
  const container = parentPath(state.selection);
  const index = state.selection.path[state.selection.path.length - 1];
  const siblings = childrenAt(system, container);
  const moved = siblings[index];
  const rest = [...siblings.slice(0, index), ...siblings.slice(index + 1)];
  const at = hasInterjection(moved) ? interjectedCount(rest) : rest.length;

  return {
    ...state,
    system: updateChildrenAt(system, container, () => [...rest.slice(0, at), moved, ...rest.slice(at)]),
    selection: childPath(container, at),
    dirty: true,
  };
}

/**
 * Everything the selected bid continues into, or a root's own bids. The folder holds nothing of its own - what it shows lives
 * in the list belonging to the container beneath it - so it copies as nothing, which keeps it out of these commands too.
 */
function selectedChildren(state: BrowserState): EditableBidNode[] {
  return state.selection === null || isFolderPath(state.selection) ? [] : childrenAt(state.system, state.selection);
}

function cutChildren(state: BrowserState): BrowserState {
  const selection = state.selection;
  if (selection === null || isFolderPath(selection)) {
    return state;
  }

  const children = childrenAt(state.system, selection);
  if (children.length === 0) {
    return state;
  }

  return { ...state, clipboard: children.map(cloneNode), system: updateChildrenAt(state.system, selection, () => []), dirty: true };
}

function paste(state: BrowserState): BrowserState {
  if (state.selection === null || state.clipboard === null) {
    return state;
  }

  const clipboard = state.clipboard;

  // Each pasted bid is placed rather than appended: one carrying an interjection has to land inside the folder, not after it.
  const system = updateChildrenAt(state.system, state.selection, (children) => clipboard.reduce((current, node) => place(current, cloneNode(node)), children));
  return { ...state, system, dirty: true };
}

function sort(state: BrowserState): BrowserState {
  const target = state.selection ?? { rootIndex: 0, path: [] };

  // Sorting the folder means sorting what it holds, and that lives in the list belonging to the container beneath it.
  const container = isFolderPath(target) ? parentPath(target) : target;

  const system = updateChildrenAt(state.system, container, (children) => {
    // The folder stays on top, so the two groups are sorted apart: the interjected ones also by the call they answer.
    const count = interjectedCount(children);
    return [...[...children.slice(0, count)].sort(compareWithInterjection), ...[...children.slice(count)].sort(compareBids)];
  });

  // Indices shift while sorting, so keep the container selected instead of pointing at a stale child.
  return { ...state, system, selection: samePath(state.selection, target) ? target : state.selection, dirty: true };
}
