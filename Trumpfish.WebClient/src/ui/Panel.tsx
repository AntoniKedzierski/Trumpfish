import './panel.css';

export type PanelAlign = 'start' | 'end';

interface PanelProps {
  /** Z której krawędzi wyzwalacza panel opada. */
  align?: PanelAlign;
  /** Czy treść przewija się, kiedy przerośnie panel. Panel z kontrolką, która sama coś otwiera, musi powiedzieć `false`. */
  scroll?: boolean;
  /** Panel otwarty w miejscu, bez własnej powierzchni - w szufladzie, gdzie nie ma z czego zwisać. */
  inline?: boolean;
  /** Komendy poza przewijaną częścią, żeby długa lista ich nie wyniosła. */
  footer?: React.ReactNode;
  id?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Powierzchnia każdego popupu w aplikacji: menu komend, lista wartości, panel filtrów, znajomi, konto.
 */
/*
 * Jeden komponent, bo osiem osobnych implementacji tego samego prostokąta rozjechało się dokładnie tam, gdzie było ich
 * osiem: w rozmiarze pisma. Tu rozmiar jest jeden i pochodzi z `panel.css`, więc żaden plik widoku nie ma jak go zmienić.
 */
export function Panel({ align = 'start', scroll = true, inline = false, footer, id, className = '', children }: PanelProps) {
  const classes = ['ui-panel', `align-${align}`, scroll ? 'scroll' : '', inline ? 'inline' : '', className];

  return (
    <div className={classes.filter((name) => name !== '').join(' ')} id={id}>
      <div className="ui-panel-body">{children}</div>
      {footer === undefined ? null : <div className="ui-panel-footer">{footer}</div>}
    </div>
  );
}

/** Kreska między jednym rodzajem pozycji a następnym. */
export function PanelSeparator() {
  return <div className="ui-panel-separator" />;
}

/** Zdanie, które nie jest pozycją listy: pusta lista, ostrzeżenie, uwaga pod polem. */
export function PanelNote({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <p className={`ui-panel-note ${className}`.trim()}>{children}</p>;
}

/** Grupa kontrolek oddzielona kreską od sąsiedniej. */
export function PanelSection({ children }: { children: React.ReactNode }) {
  return <div className="ui-panel-section">{children}</div>;
}
