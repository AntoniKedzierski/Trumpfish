import { getJson, postJson, putJson, remove } from './client';
import type { BiddingSystem, BiddingSystemSummary, ValidationIssue } from './models';

const route = '/bidding-systems';

/** The systems the signed in account works on: the seeds for an administrator, their own systems for anyone else. */
export function listBiddingSystems(): Promise<BiddingSystemSummary[]> {
  return getJson<BiddingSystemSummary[]>(route);
}

/** The seed catalogue, which anyone may read in order to fork from it. */
export function listSeedSystems(): Promise<BiddingSystemSummary[]> {
  return getJson<BiddingSystemSummary[]>(`${route}/seeds`);
}

export function getBiddingSystem(id: string): Promise<BiddingSystem> {
  return getJson<BiddingSystem>(`${route}/${id}`);
}

export function createBiddingSystem(name: string, system: BiddingSystem): Promise<BiddingSystemSummary> {
  return postJson<BiddingSystemSummary>(route, { name, system });
}

export function saveBiddingSystem(id: string, system: BiddingSystem): Promise<BiddingSystemSummary> {
  return putJson<BiddingSystemSummary>(`${route}/${id}`, system);
}

export function renameBiddingSystem(id: string, name: string): Promise<BiddingSystemSummary> {
  return putJson<BiddingSystemSummary>(`${route}/${id}/name`, { name });
}

export function deleteBiddingSystem(id: string): Promise<void> {
  return remove(`${route}/${id}`);
}

/** Takes a private copy of a seed. Administrators already own every seed, so this is for everyone else. */
export function forkSeedSystem(id: string): Promise<BiddingSystemSummary> {
  return postJson<BiddingSystemSummary>(`${route}/${id}/fork`, {});
}

/** Replaces a fork's tree with its seed's current one, discarding local changes to the copy. */
export function reforkSystem(id: string): Promise<BiddingSystemSummary> {
  return postJson<BiddingSystemSummary>(`${route}/${id}/refork`, {});
}

export function validateBiddingSystem(system: BiddingSystem): Promise<ValidationIssue[]> {
  return postJson<ValidationIssue[]>(`${route}/validate`, system);
}
