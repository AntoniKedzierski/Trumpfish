import { postJson } from './client';
import type { DoubleDummyRequest, DoubleDummyResponse } from './models';

/**
 * Plays every contract out against perfect defence and reports what each pair could actually make.
 *
 * Answered by a solver the server may not have been built with, so a 503 here means "not installed", not "broken" - the
 * caller shows what came back rather than treating it as a failure of the deal.
 */
export function solveDoubleDummy(request: DoubleDummyRequest): Promise<DoubleDummyResponse> {
  return postJson<DoubleDummyResponse>('/analysis/dds', request);
}
