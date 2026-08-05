import { getJson, postJson, putJson, remove } from './client';
import type { BiddingSystem, BiddingSystemSummary, ValidationIssue } from './models';

const route = '/bidding-systems';

export function listBiddingSystems(): Promise<BiddingSystemSummary[]> {
  return getJson<BiddingSystemSummary[]>(route);
}

export function getBiddingSystem(name: string): Promise<BiddingSystem> {
  return getJson<BiddingSystem>(`${route}/${encodeURIComponent(name)}`);
}

export function saveBiddingSystem(name: string, system: BiddingSystem): Promise<BiddingSystemSummary> {
  return putJson<BiddingSystemSummary>(`${route}/${encodeURIComponent(name)}`, system);
}

export function deleteBiddingSystem(name: string): Promise<void> {
  return remove(`${route}/${encodeURIComponent(name)}`);
}

export function validateBiddingSystem(system: BiddingSystem): Promise<ValidationIssue[]> {
  return postJson<ValidationIssue[]>(`${route}/validate`, system);
}
