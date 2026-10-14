import type { BidColor, BiddingSystem, BidNode, BidType, Root } from '@/api/models';

/** Bid made by the preceding opponent, squeezed between the parent bid and this one. Only `Submit` and `Double` are allowed. */
export interface InterjectionBid {
  type?: BidType;
  color?: BidColor;
  value?: number | string | null;
}

/**
 * Editing copy of `BidNode` where the collections are always materialised, which keeps the tree code free of `?? []` noise.
 * The inherited single `interjection` is left out: on a node of the system it is always empty, the list is what counts.
 */
export interface EditableBidNode extends Omit<BidNode, 'nextBids' | 'interjections' | 'interjection'> {
  nextBids: EditableBidNode[];
  /** Opponent calls this bid applies after, kept in auction order. Narrows the generated `Bid` down to the fields that matter. */
  interjections: InterjectionBid[];
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
  return { nodeId: newNodeId(), type: 'Submit', color: color ?? 'NoColor', value: value ?? null, openerBid, interjections: [], nextBids: [] };
}

/** Identity used to address a single bid; `crypto.randomUUID` is unavailable over plain HTTP, hence the fallback. */
function newNodeId(): string {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

export function normalizeSystem(system: BiddingSystem): EditableSystem {
  return { systemName: system.systemName ?? 'NewSystem', roots: (system.roots ?? []).map((root) => ({ ...root, bids: groupInterjected((root.bids ?? []).map(normalizeNode)) })) };
}

function normalizeNode(node: BidNode): EditableBidNode {
  // The single inherited field never carries anything on a node, so it is dropped rather than sent back on save.
  const copy = { ...node };
  delete copy.interjection;

  return {
    ...copy,
    nodeId: node.nodeId ?? newNodeId(),
    interjections: sortInterjections(node.interjections ?? []),
    nextBids: groupInterjected((node.nextBids ?? []).map(normalizeNode)),
  };
}

export function hasInterjection(node: EditableBidNode): boolean {
  return node.interjections.length > 0;
}

/** Auction order: by level, then ♣ < ♦ < ♥ < ♠ < NT, with the double after every bid. */
export function compareInterjections(left: InterjectionBid, right: InterjectionBid): number {
  return interjectionRank(left) - interjectionRank(right);
}

function interjectionRank(bid: InterjectionBid): number {
  return bid.type === 'Double' ? Number.MAX_SAFE_INTEGER : Number(bid.value ?? 0) * 10 + colorOrder(bid.color);
}

export function sortInterjections(interjections: readonly InterjectionBid[]): InterjectionBid[] {
  return [...interjections].sort(compareInterjections);
}

export function sameInterjection(left: InterjectionBid, right: InterjectionBid): boolean {
  return left.type === right.type && (left.color ?? 'NoColor') === (right.color ?? 'NoColor') && Number(left.value ?? 0) === Number(right.value ?? 0);
}

/** Plain text of an interjection, for tooltips; the drawn version is `BidCard`. */
export function formatInterjection(bid: InterjectionBid): string {
  return bid.type === 'Double' ? 'X' : `${bid.value ?? ''}${colorMark(bid.color)}`;
}

/**
 * Puts the bids that carry an interjection at the front of a list, keeping their order among themselves.
 *
 * The tree shows them inside a folder, and that folder is drawn over a leading run of the list rather than being a node of its
 * own - so this ordering is what makes the folder possible at all. Applied when a tree is loaded, since a file may have been
 * written before the grouping existed.
 */
export function groupInterjected(children: EditableBidNode[]): EditableBidNode[] {
  const interjected = children.filter(hasInterjection);
  if (interjected.length === 0 || interjected.length === children.length) {
    return children;
  }

  return [...interjected, ...children.filter((node) => !hasInterjection(node))];
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
  return compareByRank(left, right);
}

/** Orders the bids inside the interjection folder: by the bid itself first, then by the lowest opponent call that precedes it. */
export function compareWithInterjection(left: EditableBidNode, right: EditableBidNode): number {
  const byBid = compareByRank(left, right);
  return byBid !== 0 ? byBid : compareInterjections(left.interjections[0] ?? {}, right.interjections[0] ?? {});
}

function compareByRank(left: { color?: BidColor; value?: number | string | null }, right: { color?: BidColor; value?: number | string | null }): number {
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

/*
 * Same słowa. Znak koloru dokłada do nich `SuitMark` tam, gdzie lista jest rysowana - znak wpisany w tekst jako `♣` jest
 * znakiem z czcionki systemowej, który na iOS podmienia się na kolorowe emoji i przestaje słuchać barwy (patrz
 * `components/suits.tsx`). Etykieta zostaje więc tym, czym jest: nazwą, którą czyta czytnik ekranu i dymek.
 */
export const bidColorLabels: Record<BidColor, string> = { NoColor: '-', Clubs: 'Trefle', Diamonds: 'Kara', Hearts: 'Kiery', Spades: 'Piki', NoTrump: 'Bez atu' };

/**
 * Czy z jednej odzywki wolno przejść do drugiej.
 */
/*
 * Dwa warunki i nic więcej: ta sama wartość, bo przejście oznacza dalszy ciąg tej samej odzywki, i ten sam gracz, bo
 * otwierający prowadzi swoją gałąź, a odpowiadający swoją. Sama siebie odzywka wskazać nie może - to byłaby pętla.
 */
export function canContinueTo(source: EditableBidNode, candidate: EditableBidNode): boolean {
  if (source.type === "Double") {
    return candidate.nodeId !== source.nodeId && (source.openerBid ?? false) === (candidate.openerBid ?? false);
  }

  return candidate.nodeId !== source.nodeId
    && sameValue(source.value, candidate.value)
    && (source.openerBid ?? false) === (candidate.openerBid ?? false);
}

function sameValue(left: number | string | null | undefined, right: number | string | null | undefined): boolean {
  return (left ?? null) === null && (right ?? null) === null ? true : Number(left) === Number(right);
}
