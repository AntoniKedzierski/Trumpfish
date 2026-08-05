import { postJson } from './client';
import type { SimulationRequest, SimulationResponse } from './models';

export function simulateBidding(request: SimulationRequest): Promise<SimulationResponse> {
  return postJson<SimulationResponse>('/simulation/bidding', request);
}
