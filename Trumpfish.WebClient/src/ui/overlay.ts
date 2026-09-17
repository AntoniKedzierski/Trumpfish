/**
 * Warstwa rysowana do `body`, a nie w miejscu wywołania: lista wartości ComboBoxa.
 */
/*
 * Taka warstwa leży poza drzewem kontrolki, która ją otworzyła, więc dla każdego „kliknięcie obok znaczy zamknij"
 * wygląda jak kliknięcie obok - i panel zamykałby się w chwili, w której użytkownik wybiera z listy stojącej w nim.
 *
 * Znacznik jest jeden i pytanie o niego jest jedno. Kontrolka, która sama coś otwiera do `body`, dopisuje
 * `data-ui-overlay`; każdy, kto nasłuchuje kliknięć obok siebie, pyta tą funkcją.
 */
export const overlayMark = 'data-ui-overlay';

/** Czy kliknięcie wylądowało w warstwie rysowanej do `body` - czyli w czymś, co należy do otwartej kontrolki. */
export function isInsideOverlay(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(`[${overlayMark}]`) !== null;
}
