/** Gdzie mieszka widok analizy. Osobno, żeby listy rozdań mogły do niego prowadzić, nie wciągając całej strony. */
export const analyzerRoute = '/tools/analyzer';

/** Tryb, w jakim rozdanie się otwiera. Stoi w adresie, więc replay nie zaczyna się od pokazania wszystkich kart. */
export type AnalyzerMode = 'analysis' | 'replay';

/** Adres jednego rozdania w wybranym trybie. Tryb analizy jest domyślny i nie dopisuje się do adresu. */
export function analyzerLink(dealId: string, mode: AnalyzerMode = 'analysis'): string {
  return mode === 'analysis' ? `${analyzerRoute}/${dealId}` : `${analyzerRoute}/${dealId}?mode=${mode}`;
}
