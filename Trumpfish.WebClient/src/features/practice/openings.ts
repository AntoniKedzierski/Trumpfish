import type { BidColor, BidType, BiddingSystem, BidNode } from '@/api/models';
import { toNumber } from '@/api/models';
import { bidCode } from '@/features/biddingBrowser/model';

/** Name of the root the engine opens from; the practice list is built out of exactly the bids it holds. */
const openingsRootName = 'Otwarcia';

export interface OpeningChoice {
  nodeId: string;
  /** The bid itself, e.g. `1♣`. Several openings can share it - that is the point of listing them separately. */
  label: string;
  /** The same bid taken apart, so it can be drawn with a tinted suit mark rather than printed as a character. */
  type: BidType;
  color: BidColor;
  level: number | null;
  /** What the system says the bid promises, which is what tells three different 1♣ openings apart. */
  meaning: string;
}

/**
 * Every opening the system offers, in tree order, each with its own meaning. Openings sharing a bid are listed one by one
 * rather than folded together: a system with three different 1♣ openings gives three separate things to practise.
 */
export function openingChoices(system: BiddingSystem | null): OpeningChoice[] {
  const root = (system?.roots ?? []).find((candidate) => (candidate.name ?? '').trim() === openingsRootName);

  return (root?.bids ?? [])
    .filter((node) => !node.isDisabled && node.nodeId)
    .map((node) => ({
      nodeId: node.nodeId as string,
      label: label(node),
      type: node.type ?? 'Submit',
      color: node.color ?? 'NoColor',
      level: toNumber(node.value),
      meaning: meaning(node),
    }));
}

function label(node: BidNode): string {
  return `${node.value ?? ''}${bidCode(node)}`.trim();
}

function meaning(node: BidNode): string {
  const parts = [node.condition, node.convention === null || node.convention === undefined ? null : `⟨${node.convention}⟩`, node.description];
  const first = parts.find((part) => typeof part === 'string' && part.trim() !== '');
  return typeof first === 'string' ? first.trim() : 'bez opisu';
}

/** Name of the root holding the defences - bids made after an opponent opened. */
const defencesRootName = 'Obrona';

/** One of the opponents' bids a defence answers, taken apart the same way as the defence itself. */
export interface DefenceAfter {
  label: string;
  type: BidType;
  color: BidColor;
  level: number | null;
}

/** A defence: an opening-like choice, plus the opponents' bids it is made after - which is what tells two kinds of double apart. */
export interface DefenceChoice extends OpeningChoice {
  after: DefenceAfter[];
}

/**
 * Every defence the engine can make, in tree order: a switched-on bid of the defences root that names the opponents' bids it
 * answers. A bid there without them is never picked - the engine chooses a defence by the bid that was just made - and one that
 * sends the player to the openings is an opening, not a defence. The server's `TableEngine.FindDefence` applies the same rule.
 */
export function defenceChoices(system: BiddingSystem | null): DefenceChoice[] {
  const root = (system?.roots ?? []).find((candidate) => (candidate.name ?? '').trim() === defencesRootName);

  return (root?.bids ?? [])
    .filter((node) => !node.isDisabled && !node.goToOpenings && node.nodeId && (node.interjections ?? []).length > 0)
    .map((node) => ({
      nodeId: node.nodeId as string,
      label: label(node),
      type: node.type ?? 'Submit',
      color: node.color ?? 'NoColor',
      level: toNumber(node.value),
      meaning: meaning(node),
      after: (node.interjections ?? []).map((bid) => ({
        label: `${bid.value ?? ''}${bidCode(bid)}`.trim(),
        type: bid.type ?? 'Submit',
        color: bid.color ?? 'NoColor',
        level: toNumber(bid.value),
      })),
    }));
}
