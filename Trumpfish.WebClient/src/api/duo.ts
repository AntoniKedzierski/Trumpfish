import { getJson, getResponse } from './client';
import type { DuoInvitation, DuoTableState } from './models';

const route = '/duo';

/** Invitations that arrived before this page was open. Everything after that comes over the hub. */
export function listTableInvitations(): Promise<DuoInvitation[]> {
  return getJson<DuoInvitation[]>(`${route}/invitations`);
}

/** The table this account is sitting at, or null when it is not at one. Answers 204 in that second case. */
export async function getTable(): Promise<DuoTableState | null> {
  const response = await getResponse(`${route}/table`);
  return response.status === 204 ? null : ((await response.json()) as DuoTableState);
}
