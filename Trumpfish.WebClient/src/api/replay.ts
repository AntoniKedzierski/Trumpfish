import { postJson } from './client';
import type { ReplayBidRequest, ReplayStartRequest, ReplayState } from './models';

/** Sadza gracza przy gotowym rozdaniu i pozwala botom licytować aż do jego pierwszej kolejki. */
export function startReplay(request: ReplayStartRequest): Promise<ReplayState> {
  return postJson<ReplayState>('/replay/start', request);
}

/** Zgłasza odzywkę gracza i pozwala botom odpowiedzieć, aż do jego następnej kolejki albo do końca licytacji. */
export function submitReplayBid(request: ReplayBidRequest): Promise<ReplayState> {
  return postJson<ReplayState>('/replay/bid', request);
}
