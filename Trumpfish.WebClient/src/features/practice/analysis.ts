import type { PracticeRole, SimulationDealResult } from '@/api/models';

/**
 * One deal the player kept for later study. The whole auction and all four hands come along, so the file is enough on its own -
 * the analysis tool will not need the system it was practised against in order to read it.
 */
export interface SavedDeal {
  savedAt: string;
  systemName: string;
  seed: string | null;
  /** The opening being practised, as it was labelled in the picker; null when the session practised everything. */
  opening: string | null;
  role: PracticeRole;
  deal: SimulationDealResult;
}

/** What a saved session looks like on disk. Versioned, so the analysis tool can tell an old export from a new one. */
interface PracticeExport {
  kind: 'trumpfish.practice';
  version: 1;
  exportedAt: string;
  deals: SavedDeal[];
}

export function exportDeals(deals: readonly SavedDeal[]): void {
  const payload: PracticeExport = { kind: 'trumpfish.practice', version: 1, exportedAt: new Date().toISOString(), deals: [...deals] };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));

  const link = document.createElement('a');
  link.href = url;
  link.download = `cwiczenie-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
  link.click();

  URL.revokeObjectURL(url);
}
