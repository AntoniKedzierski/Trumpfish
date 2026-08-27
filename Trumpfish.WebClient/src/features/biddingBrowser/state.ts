import { toNumber, type BidColor, type ValidationIssue } from '@/api/models';
import { cloneNode, compareBids, createBidNode, createEmptySystem, type EditableBidNode, type EditableSystem, type NodePath } from './model';
import { childPath, getNode, parentPath, samePath, updateChildrenAt, updateNodeAt } from './tree';

const suitLadder: readonly BidColor[] = ['Clubs', 'Diamonds', 'Hearts', 'Spades', 'NoTrump'];

export interface BrowserState {
  system: EditableSystem;
  selection: NodePath | null;
  clipboard: EditableBidNode | null;
  issues: ValidationIssue[] | null;
  dirty: boolean;
}

export type BrowserAction =
  | { kind: 'loadSystem'; system: EditableSystem }
  | { kind: 'setSystemName'; name: string }
  | { kind: 'select'; target: NodePath | null }
  | { kind: 'addBid' }
  | { kind: 'deleteBid' }
  | { kind: 'moveUp' }
  | { kind: 'moveDown' }
  | { kind: 'updateNode'; patch: Partial<EditableBidNode> }
  | { kind: 'copy' }
  | { kind: 'paste' }
  | { kind: 'sort' }
  | { kind: 'setIssues'; issues: ValidationIssue[] | null }
  | { kind: 'markSaved' };

export const initialBrowserState: BrowserState = { system: createEmptySystem(), selection: null, clipboard: null, issues: null, dirty: false };

export function browserReducer(state: BrowserState, action: BrowserAction): BrowserState {
  switch (action.kind) {
    case 'loadSystem':
      return { ...initialBrowserState, system: action.system, clipboard: state.clipboard };

    case 'setSystemName':
      return { ...state, system: { ...state.system, systemName: action.name }, dirty: true };

    case 'select':
      return { ...state, selection: action.target };

    case 'addBid':
      return addBid(state);

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
      return node === null ? state : { ...state, clipboard: cloneNode(node) };
    }

    case 'paste':
      return paste(state);

    case 'sort':
      return sort(state);

    case 'setIssues':
      return { ...state, issues: action.issues };

    case 'markSaved':
      return { ...state, dirty: false };
  }
}

function addBid(state: BrowserState): BrowserState {
  if (state.selection === null) {
    return state;
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
  if (state.selection === null || state.selection.path.length === 0) {
    return state;
  }

  const system = updateNodeAt(state.system, state.selection, () => null);
  return { ...state, system, selection: parentPath(state.selection), dirty: true };
}

function moveBy(state: BrowserState, offset: number): BrowserState {
  if (state.selection === null || state.selection.path.length === 0) {
    return state;
  }

  const container = parentPath(state.selection);
  const index = state.selection.path[state.selection.path.length - 1];
  let movedTo = index;

  const system = updateChildrenAt(state.system, container, (children) => {
    const target = index + offset;
    if (target < 0 || target >= children.length) {
      return children;
    }

    const reordered = [...children];
    const [node] = reordered.splice(index, 1);
    reordered.splice(target, 0, node);
    movedTo = target;
    return reordered;
  });

  return { ...state, system, selection: childPath(container, movedTo), dirty: true };
}

function updateSelected(state: BrowserState, patch: Partial<EditableBidNode>): BrowserState {
  if (state.selection === null || state.selection.path.length === 0) {
    return state;
  }

  return { ...state, system: updateNodeAt(state.system, state.selection, (node) => ({ ...node, ...patch })), dirty: true };
}

function paste(state: BrowserState): BrowserState {
  if (state.selection === null || state.clipboard === null) {
    return state;
  }

  const system = updateChildrenAt(state.system, state.selection, (children) => [...children, cloneNode(state.clipboard!)]);
  return { ...state, system, dirty: true };
}

function sort(state: BrowserState): BrowserState {
  const target = state.selection ?? { rootIndex: 0, path: [] };
  const system = updateChildrenAt(state.system, target, (children) => [...children].sort(compareBids));

  // Indices shift while sorting, so keep the container selected instead of pointing at a stale child.
  return { ...state, system, selection: samePath(state.selection, target) ? target : state.selection, dirty: true };
}
