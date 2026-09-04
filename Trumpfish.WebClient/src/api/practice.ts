import { postJson } from './client';
import type { PracticeBidRequest, PracticeHint, PracticeStartRequest, PracticeState } from './models';

/** Deals a fresh hand and lets the bots bid up to the player's first turn. */
export function startPracticeDeal(request: PracticeStartRequest): Promise<PracticeState> {
  return postJson<PracticeState>('/practice/deal', request);
}

/** Plays the player's bid and lets the bots answer, up to his next turn or the end of the auction. */
export function submitPracticeBid(request: PracticeBidRequest): Promise<PracticeState> {
  return postJson<PracticeState>('/practice/bid', request);
}

/** What the engine would bid holding the player's cards. Asked for on demand, so the answer never arrives unwanted. */
export function getPracticeHint(state: string): Promise<PracticeHint> {
  return postJson<PracticeHint>('/practice/hint', { state });
}
