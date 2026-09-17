/**
 * O ile przesunąć warstwę w poziomie, żeby mieściła się tam, gdzie widać.
 */
/*
 * Granicą nie jest samo okno. Warstwa rysowana w miejscu wywołania jest obcinana przez każdą ramkę z własnym
 * przewijaniem, która stoi nad nią - a takich ramek jest w tej aplikacji pełno, bo każdy widok z paskiem narzędzi jest
 * ramką na wysokość okna. Bąbelek wyjaśnienia odzywki w wąskiej kolumnie analizy znikał właśnie tak: mierzony względem
 * okna mieścił się w nim bez zarzutu, a ucinała go kolumna.
 *
 * Warstwa szersza niż to, co ją obcina, nie jest przesuwana: nie ma dokąd, a szarpnięcie w bok tylko zmieniłoby to,
 * której połowy nie widać.
 */
export function horizontalNudge(element: HTMLElement, margin = 8): number {
  const box = element.getBoundingClientRect();
  let left = margin;
  let right = window.innerWidth - margin;

  for (let frame = element.parentElement; frame !== null; frame = frame.parentElement) {
    if (window.getComputedStyle(frame).overflowX === 'visible') {
      continue;
    }

    const bounds = frame.getBoundingClientRect();
    left = Math.max(left, bounds.left + margin);
    right = Math.min(right, bounds.right - margin);
  }

  if (box.width > right - left) {
    return 0;
  }

  if (box.left < left) {
    return Math.round(left - box.left);
  }

  if (box.right > right) {
    return Math.round(right - box.right);
  }

  return 0;
}
