import type { BiddingSystem, BidNode } from '@/api/models';
import { bidCode } from '@/features/biddingBrowser/model';

/** Name of the root the engine opens from; the practice list is built out of exactly the bids it holds. */
const openingsRootName = 'Otwarcia';

export interface OpeningChoice {
  nodeId: string;
  /** The bid itself, e.g. `1♣`. Several openings can share it - that is the point of listing them separately. */
  label: string;
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
    .map((node) => ({ nodeId: node.nodeId as string, label: label(node), meaning: meaning(node) }));
}

function label(node: BidNode): string {
  return `${node.value ?? ''}${bidCode(node)}`.trim();
}

function meaning(node: BidNode): string {
  const parts = [node.condition, node.convention === null || node.convention === undefined ? null : `⟨${node.convention}⟩`, node.description];
  const first = parts.find((part) => typeof part === 'string' && part.trim() !== '');
  return typeof first === 'string' ? first.trim() : 'bez opisu';
}
