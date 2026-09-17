import { getJson, postJson, putJson, putNoContent, remove } from './client';
import type { SaveDealRequest, SavedDeal, SavedDealPage, SavedDealSummary, SavedDealTag, SharedDealPage, UpdateSavedDealRequest } from './models';

/** Keeps one deal on the signed in user's account. The deal travels exactly as it was drawn. */
export function saveDeal(request: SaveDealRequest): Promise<SavedDealSummary> {
  return postJson<SavedDealSummary>('/deals', request);
}

/** Jedno rozdanie w całości - karty, licytacja i kontrakt. Własne i udostępnione otwiera się tak samo. */
export function getSavedDeal(id: string): Promise<SavedDeal> {
  return getJson<SavedDeal>(`/deals/${id}`);
}

/** The user's own keywords, most used first. The tag field suggests from this as it is typed into. */
export function listMyDealTags(): Promise<SavedDealTag[]> {
  return getJson<SavedDealTag[]>('/deals/tags');
}

interface SavedDealQuery {
  /** The contract search as it was typed: "NT", "1S", "1d, H". */
  contract?: string;
  /** Keywords every deal in the answer has to carry. */
  tags?: string;
  oldestFirst?: boolean;
  page?: number;
  pageSize?: number;
}

/** What both lists are narrowed by, written the same way for both of them. */
function filterParameters(query: SavedDealQuery): URLSearchParams {
  const parameters = new URLSearchParams();

  if (query.contract !== undefined && query.contract.trim() !== '') {
    parameters.set('contract', query.contract.trim());
  }

  if (query.tags !== undefined && query.tags.trim() !== '') {
    parameters.set('tags', query.tags.trim());
  }

  if (query.oldestFirst === true) {
    parameters.set('oldestFirst', 'true');
  }

  parameters.set('page', String(query.page ?? 1));
  parameters.set('pageSize', String(query.pageSize ?? 50));

  return parameters;
}

/** One page of the user's own deals. */
export function listSavedDeals(query: SavedDealQuery): Promise<SavedDealPage> {
  return getJson<SavedDealPage>(`/deals?${filterParameters(query).toString()}`);
}

/** Changes the name, the keywords and the remark. The deal itself is a record of what happened and is never edited. */
export function updateSavedDeal(id: string, request: UpdateSavedDealRequest): Promise<SavedDealSummary> {
  return putJson<SavedDealSummary>(`/deals/${id}`, request);
}

/** Removes one deal for good. */
export function deleteSavedDeal(id: string): Promise<void> {
  return remove(`/deals/${id}`);
}

interface SharedDealQuery extends SavedDealQuery {
  /** Part of the name of whoever shared it. */
  sharedBy?: string;
}

/** One page of the deals other people have shared with the signed in user. */
export function listSharedDeals(query: SharedDealQuery): Promise<SharedDealPage> {
  const parameters = filterParameters(query);
  if (query.sharedBy !== undefined && query.sharedBy.trim() !== '') {
    parameters.set('sharedBy', query.sharedBy.trim());
  }

  return getJson<SharedDealPage>(`/deals/shared?${parameters.toString()}`);
}

/** Who this deal is shared with right now, so the dialog opens on what is already true. */
export function getDealShares(id: string): Promise<string[]> {
  return getJson<string[]>(`/deals/${id}/shares`);
}

/** Shares the deal with exactly these friends; anybody dropped from the set stops seeing it. */
export function setDealShares(id: string, userIds: readonly string[]): Promise<void> {
  return putNoContent(`/deals/${id}/shares`, { userIds });
}

/** Stops receiving one shared deal. What the owner keeps is untouched. */
export function removeSharedDeal(shareId: string): Promise<void> {
  return remove(`/deals/shared/${shareId}`);
}
