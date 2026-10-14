import { Fragment } from 'react';
import { BidCard } from '@/ui';
import type { InterjectionBid } from '../model';

interface InterjectionListProps {
  interjections: readonly InterjectionBid[];
  /** Draws only the first few and says how many more there are - for a field too narrow to hold the whole list. */
  limit?: number;
}

/**
 * The opponent calls a bid applies after, drawn as calls separated by commas: `1♠, 2♣, 2♦`.
 */
/*
 * One drawing for the tree, the path above the editor and the picker field, so a list reads the same wherever it is shown.
 */
export function InterjectionList({ interjections, limit }: InterjectionListProps) {
  const shown = limit === undefined ? interjections : interjections.slice(0, limit);
  const hidden = interjections.length - shown.length;

  return (
    <>
      {shown.map((interjection, index) => (
        <Fragment key={index}>
          {index > 0 && ', '}
          <BidCard bid={interjection} />
        </Fragment>
      ))}
      {hidden > 0 && <span className="interjection-more"> +{hidden}</span>}
    </>
  );
}
