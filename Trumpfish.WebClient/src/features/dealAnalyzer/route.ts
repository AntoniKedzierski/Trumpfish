/** Gdzie mieszka widok analizy. Osobno, żeby listy rozdań mogły do niego prowadzić, nie wciągając całej strony. */
export const analyzerRoute = '/tools/analyzer';

/** Tryb, w jakim rozdanie się otwiera. Stoi w adresie, więc replay nie zaczyna się od pokazania wszystkich kart. */
export type AnalyzerMode = 'analysis' | 'replay';

/** Od tej szerokości okna edytor systemu i analiza mają obok siebie dość miejsca, żeby obie części były do użycia. */
export const splitMinimumWindow = 1280;

/** Najwęższa analiza i najwęższy edytor, jakie mają jeszcze sens. Suma mieści się w oknie, od którego podział jest w ogóle oferowany. */
export const minimumAnalysisWidth = 480;
export const minimumSystemWidth = 760;

/**
 * Adres jednego rozdania. Tryb analizy jest domyślny i nie dopisuje się do adresu; podział widoku dopisuje się zawsze,
 * bo ma przetrwać i wybór innego rozdania, i odświeżenie strony.
 */
export function analyzerLink(dealId: string, mode: AnalyzerMode = 'analysis', split = false): string {
  return `${analyzerRoute}/${dealId}${query(mode, split)}`;
}

/** Adres samej listy rozdań - „wczytaj inne", które ma wrócić do tego samego układu. */
export function analyzerPickerLink(split = false): string {
  return `${analyzerRoute}${query('analysis', split)}`;
}

function query(mode: AnalyzerMode, split: boolean): string {
  const parameters = new URLSearchParams();

  if (mode !== 'analysis') {
    parameters.set('mode', mode);
  }

  if (split) {
    parameters.set('split', '1');
  }

  const written = parameters.toString();
  return written === '' ? '' : `?${written}`;
}
