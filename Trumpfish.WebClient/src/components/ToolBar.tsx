import { useRef } from 'react';
import { useShedLevel } from './useFitsOnOneRow';
import '@/styles/toolbar.css';

/**
 * Jedyny pasek, z którego steruje się widokiem narzędzia: co można zrobić po lewej, co się dzieje po prawej.
 */
/*
 * Były trzy takie paski - komendy przeglądarki, ustawienia symulatora i pasek stanu nad obydwoma - i rozjechały się w
 * wysokości, w stopniu pisma i w tym, przy której krawędzi stoją przyciski. Teraz jest jeden komponent, więc paska nie
 * da się zbudować inaczej.
 *
 * Pasek się nie przewija: widok, do którego należy, jest ramką na wysokość okna (patrz `AppLayout.css`), a przewija się
 * jego zawartość pod nim.
 *
 * Kiedy komendy przestają się mieścić w jednej linijce, tracą słowa i zostają same znaki. **Mierzone, a nie zgadywane
 * progiem szerokości ekranu**: próg to liczba udająca odpowiedź, i myli się w dniu, w którym ktoś doda przycisk albo
 * nazwie system dłuższym słowem. Na telefonie, na którym wszystko się mieści, słowa zostają.
 *
 * Słowa oddawane są po kolei, a nie wszystkie naraz - kolejność mówi `toolbarKeep` i `toolbarKeepLonger` niżej.
 */
export function ToolBar({ children, status }: { children: React.ReactNode; status?: React.ReactNode }) {
  const commands = useRef<HTMLDivElement>(null);
  const shed = useShedLevel(commands);
  const classes = ['toolbar', shed >= 1 ? 'icons-only' : '', shed >= 2 ? 'shed-all' : ''].filter((name) => name !== '');

  return (
    <div className={classes.join(' ')}>
      <div className="toolbar-commands" ref={commands}>{children}</div>
      {/* Montowany niezależnie od tego, czy ma coś do powiedzenia: region ogłoszony dopiero przy pojawieniu się bywa przemilczany. */}
      <div className="toolbar-status" role="status">{status}</div>
    </div>
  );
}

/**
 * Komenda, która nigdy nie oddaje swojego słowa - bo to słowo jest jej treścią, a nie ozdobą.
 *
 * Tyle jej wolno: sam znak nie powie, który system jest otwarty.
 */
export const toolbarKeep = 'toolbar-keep';

/** Komenda, która oddaje słowo jako ostatnia: ta jedna, po którą użytkownik tu przyszedł. */
export const toolbarKeepLonger = 'toolbar-keep-longer';
