export interface ToolDescriptor {
  id: string;
  title: string;
  description: string;
  route: string;
  enabled: boolean;
}

/** Adding a tool to the start page is a single entry here plus a route in `App.tsx`. */
export const tools: ToolDescriptor[] = [
  {
    id: 'bidding-browser',
    title: 'Bidding Browser',
    description: 'Twórz i edytuj systemy licytacyjne jako drzewo odzywek, waliduj je i zapisuj na serwerze.',
    route: '/tools/bidding-browser',
    enabled: true,
  },
  {
    id: 'simulation',
    title: 'Symulacja licytacji',
    description: 'Wygeneruj rozdania, pozwól silnikowi rozegrać licytację i przejrzyj ręce, punkty oraz przebieg licytacji.',
    route: '/tools/simulation',
    enabled: true,
  },
  {
    id: 'bidding-practice',
    title: 'Ćwiczenie licytacji',
    description: 'Licytuj z trzema botami, jedno rozdanie na raz. Wybierz otwarcie do przećwiczenia, a karty rozdadzą się pod nie.',
    route: '/tools/practice',
    enabled: true,
  },
  {
    id: 'play-vs-ai',
    title: 'Gra z AI',
    description: 'Rozegraj licytację i rozgrywkę przeciwko silnikowi Trumpfish. W przygotowaniu.',
    route: '/tools/play',
    enabled: false,
  },
  {
    id: 'deal-analyzer',
    title: 'Analiza rozdania',
    description: 'Oceń rękę i rozkład, sprawdź sugestie systemu dla konkretnego rozdania. W przygotowaniu.',
    route: '/tools/analyzer',
    enabled: false,
  },
];
