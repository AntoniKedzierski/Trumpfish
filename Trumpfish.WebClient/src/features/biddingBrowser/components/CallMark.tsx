import { toNumber } from '@/api/models';
import { BidMark } from '@/components/suits';
import type { InterjectionBid } from '../model';

/**
 * One call, drawn the way every call in the application is drawn.
 */
/*
 * The browser used to print `♠ ♥ ♦ ♣` as text. Those are emoji-presentation characters on iOS, where the system
 * substitutes its own colour glyphs and ignores `color` entirely, so the suit tinting the tree depends on simply did not
 * happen. The shared mark is a drawn path filled with `currentColor`, which takes the tint - including the greying of a
 * disabled branch - the way the stylesheet already expects.
 *
 * Both a bid and an interjection are read through the same three fields, so one component covers the tree, the path above
 * the editor and the interjection picker alike.
 */
export function CallMark({ bid }: { bid: InterjectionBid }) {
  return <BidMark type={bid.type ?? 'Submit'} color={bid.color ?? 'NoColor'} level={toNumber(bid.value)} />;
}
