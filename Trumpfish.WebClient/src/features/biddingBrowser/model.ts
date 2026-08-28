import type { BidColor, BiddingSystem, BidNode, BidType, Root } from '@/api/models';

/** Bid made by the preceding opponent, squeezed between the parent bid and this one. Only `Submit` and `Double` are allowed. */
export interface InterjectionBid {
  type?: BidType;
  color?: BidColor;
  value?: number | string | null;
}

/** Editing copy of `BidNode` where the children collection is always materialised, which keeps the tree code free of `?? []` noise. */
export interface EditableBidNode extends Omit<BidNode, 'nextBids'> {
  nextBids: EditableBidNode[];
  /** Mirrors `BidNode.IsPreferred`; declared here until `schema.d.ts` is regenerated from the OpenAPI document. */
  isPreferred?: boolean;
  /** Mirrors `BidNode.Interjection`; declared here until `schema.d.ts` is regenerated from the OpenAPI document. */
  interjection?: InterjectionBid | null;
}

export interface EditableRoot extends Omit<Root, 'bids'> {
  bids: EditableBidNode[];
}

export interface EditableSystem extends Omit<BiddingSystem, 'roots'> {
  systemName: string;
  roots: EditableRoot[];
}

/** Points at a node inside the tree: which root, then the child index on every level. An empty path selects the root itself. */
export interface NodePath {
  rootIndex: number;
  path: number[];
}

export const defaultRootNames = ['Otwarcia', 'Obrona', 'Konwencje', 'Reguły'];

export function createEmptySystem(systemName = 'NewSystem'): EditableSystem {
  return { systemName, roots: defaultRootNames.map((name) => ({ name, bids: [] })) };
}

export function createBidNode(color: BidColor | undefined, value: number | string | undefined, openerBid: boolean): EditableBidNode {
  return { nodeId: newNodeId(), type: 'Submit', color: color ?? 'NoColor', value: value ?? null, openerBid, nextBids: [] };
}

/** Identity used to address a single bid; `crypto.randomUUID` is unavailable over plain HTTP, hence the fallback. */
function newNodeId(): string {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

export function normalizeSystem(system: BiddingSystem): EditableSystem {
  return { systemName: system.systemName ?? 'NewSystem', roots: (system.roots ?? []).map((root) => ({ ...root, bids: (root.bids ?? []).map(normalizeNode) })) };
}

function normalizeNode(node: BidNode): EditableBidNode {
  return { ...node, nodeId: node.nodeId ?? newNodeId(), nextBids: (node.nextBids ?? []).map(normalizeNode) };
}

/** Deep clone used by copy/paste so pasted subtrees never share references - or identities - with the source. */
export function cloneNode(node: EditableBidNode): EditableBidNode {
  return { ...node, nodeId: newNodeId(), nextBids: node.nextBids.map(cloneNode) };
}

export function bidCode(node: Pick<EditableBidNode, 'type' | 'color'>): string {
  if (node.type === 'Pass') {
    return 'Pass';
  }
  if (node.type === 'Double') {
    return 'X';
  }
  if (node.type === 'Redouble') {
    return 'XX';
  }

  return colorMark(node.color);
}

export function colorMark(color: BidColor | undefined): string {
  switch (color) {
    case 'Clubs':
      return '♣';
    case 'Diamonds':
      return '♦';
    case 'Hearts':
      return '♥';
    case 'Spades':
      return '♠';
    case 'NoTrump':
      return 'NT';
    default:
      return '';
  }
}

/** Maps a bid onto the per suit colours used by the WPF browser (clubs green, diamonds amber, hearts red, spades blue, NT magenta). */
export function suitClassName(node: Pick<EditableBidNode, 'type' | 'color'>): string {
  if (node.type !== 'Submit') {
    return 'suit';
  }

  return `suit ${(node.color ?? 'NoColor').toLowerCase()}`;
}

export function formatBid(node: EditableBidNode): string {
  const label = `${node.value ?? ''}${bidCode(node)}`.trim();
  return label.length === 0 ? '<bid>' : label;
}

/** Ordering used by the "Sort" command: level first, then ♣ < ♦ < ♥ < ♠ < NT - the same rule as `BidNode.CompareTo` on the server. */
export function compareBids(left: EditableBidNode, right: EditableBidNode): number {
  const leftValue = Number(left.value ?? 0);
  const rightValue = Number(right.value ?? 0);
  if (leftValue !== rightValue) {
    return leftValue - rightValue;
  }

  return colorOrder(left.color) - colorOrder(right.color);
}

function colorOrder(color: BidColor | undefined): number {
  const order: Record<BidColor, number> = { Clubs: 0, Diamonds: 1, Hearts: 2, Spades: 3, NoTrump: 4, NoColor: 5 };
  return color === undefined ? 5 : order[color];
}

export const bidTypeLabels: Record<BidType, string> = { Pass: 'Pas', Submit: 'Odzywka', Double: 'Kontra', Redouble: 'Rekontra' };

export const bidColorLabels: Record<BidColor, string> = { NoColor: '-', Clubs: 'Trefle ♣', Diamonds: 'Kara ♦', Hearts: 'Kiery ♥', Spades: 'Piki ♠', NoTrump: 'Bez atu' };
