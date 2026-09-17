import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

/**
 * Ile miejsca zajęłoby to, co stoi w rzędzie: szerokości dzieci, przerwy między nimi i własne wcięcie rzędu.
 */
/*
 * Liczone, kiedy wszystko jest jeszcze na ekranie, więc odpowiedź jest dobra już przy pierwszym przejściu - także
 * wtedy, gdy rząd nigdy się nie zmieścił. Automatyczny margines odpychający ostatnią grupę na koniec nie wnosi tu nic i
 * to jest poprawne: to jest luz, a nie treść.
 */
function requiredWidth(element: HTMLElement): number {
  const style = window.getComputedStyle(element);
  const children = [...element.children] as HTMLElement[];
  const gap = Number.parseFloat(style.columnGap) || 0;
  const padding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);

  return padding + Math.max(0, children.length - 1) * gap + children.reduce((total, child) => total + child.offsetWidth, 0);
}

/*
 * Luz jednego piksela. `offsetWidth` jest liczbą całkowitą zaokrąglaną w górę, a szerokości bywają ułamkowe - bez tego
 * rząd kontrolek, który mieści się co do piksela, składa się sam z siebie.
 */
const slack = 1;

/**
 * Whether a row of controls still fits across its container, measured rather than guessed.
 */
/*
 * A breakpoint would be a number standing in for the answer, and it would be wrong the day a tool is added to the bar or
 * somebody is called something longer than expected. What is actually being asked is whether these particular controls fit
 * across this particular window, and that is a measurement.
 *
 * Once folded away the row cannot be measured any more - what would be measured is the folded version, which fits by
 * definition - so the last requirement is kept and the row comes back only above it. That is what stops the two states
 * from flipping between each other at the boundary.
 */
export function useFitsOnOneRow<T extends HTMLElement>(ref: RefObject<T | null>): boolean {
  const [fits, setFits] = useState(true);
  const current = useRef(true);
  const needed = useRef(0);

  useEffect(() => {
    const element = ref.current;
    if (element === null) {
      return;
    }

    const measure = () => {
      // `clientWidth` counts the padding, so the requirement has to count it too.
      const room = element.clientWidth;

      if (!current.current) {
        if (room >= needed.current) {
          current.current = true;
          setFits(true);
        }

        return;
      }

      needed.current = requiredWidth(element);

      if (needed.current > room + slack) {
        current.current = false;
        setFits(false);
      }
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return fits;
}

/** Ile słów rząd już oddał: 0 - żadnego, 1 - słowa komend zwykłych, 2 - także tych, które oddają je jako ostatnie. */
export type ShedLevel = 0 | 1 | 2;

const deepest: ShedLevel = 2;

/**
 * O ile stopni rząd musiał się zwęzić, żeby zmieścić się w jednej linii.
 */
/*
 * To samo pytanie, co wyżej, tylko zadane trzy razy: rząd nie oddaje wszystkich słów naraz, bo nie wszystkie komendy są
 * tak samo ważne - nazwa otwartego systemu mówi, co się w ogóle edytuje, a "Dodaj" przy znaku plusa nie mówi nic ponad
 * to, co widać. Oddawane są więc po kolei, od najmniej potrzebnych.
 *
 * Każdy stopień jest mierzony, a nie liczony z góry: po zwężeniu rząd jest rysowany na nowo, efekt wchodzi jeszcze raz i
 * pyta o miejsce ponownie. Zapamiętana szerokość stopnia wyżej jest tym, przy czym rząd wraca do słów - i to ona nie
 * pozwala mu drgać w tę i we w tę na samej granicy.
 */
export function useShedLevel<T extends HTMLElement>(ref: RefObject<T | null>): ShedLevel {
  const [level, setLevel] = useState<ShedLevel>(0);
  const needed = useRef<number[]>([0, 0, 0]);

  useEffect(() => {
    const element = ref.current;
    if (element === null) {
      return;
    }

    const measure = () => {
      const room = element.clientWidth;
      needed.current[level] = requiredWidth(element);

      if (needed.current[level] > room + slack) {
        if (level < deepest) {
          setLevel((level + 1) as ShedLevel);
        }

        return;
      }

      // Stopień wyżej potrzebował więcej miejsca, więc wracamy do słów dopiero wtedy, gdy tamto miejsce naprawdę jest.
      if (level > 0 && room >= needed.current[level - 1]) {
        setLevel((level - 1) as ShedLevel);
      }
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, level]);

  return level;
}
