import type { ComponentType } from 'react';
import { BotIcon, UsersIcon } from '@/components/icons';

export interface ToolDescriptor {
  id: string;
  title: string;
  /** The title is too long for the top bar, so every tool carries a short form for the navigation as well. */
  navLabel: string;
  description: string;
  route: string;
  enabled: boolean;
  /** Tools that answer the same question collapse into one entry in the top bar. Identifies which, if any. */
  group?: string;
  /** Shown beside the label inside a group's menu. Top level entries are named, not drawn, so they go without. */
  icon?: ComponentType<{ className?: string }>;
}

export interface ToolGroup {
  id: string;
  label: string;
}

/*
 * A group earns its place once a heading would tell the user more than the tools under it would on their own. Practising
 * alone and practising with a partner are the same errand, so the bar says "Ćwiczenie" once and lets the user pick a seat.
 */
export const toolGroups: ToolGroup[] = [{ id: 'practice', label: 'Ćwiczenie' }];

/** Adding a tool is a single entry here plus a route in `routes.tsx`; the start page and the top bar both read this list. */
export const tools: ToolDescriptor[] = [
  {
    id: 'bidding-browser',
    title: 'Bidding Browser',
    navLabel: 'Systemy',
    description: 'Twórz i edytuj systemy licytacyjne jako drzewo odzywek, waliduj je i zapisuj na serwerze.',
    route: '/tools/bidding-browser',
    enabled: true,
  },
  {
    id: 'simulation',
    title: 'Symulacja licytacji',
    navLabel: 'Symulacja',
    description: 'Wygeneruj rozdania, pozwól silnikowi rozegrać licytację i przejrzyj ręce, punkty oraz przebieg licytacji.',
    route: '/tools/simulation',
    enabled: true,
  },
  {
    id: 'bidding-practice',
    title: 'Ćwiczenie licytacji',
    navLabel: 'Z botami',
    group: 'practice',
    icon: BotIcon,
    description: 'Licytuj z trzema botami, jedno rozdanie na raz. Wybierz otwarcie do przećwiczenia, a karty rozdadzą się pod nie.',
    route: '/tools/practice',
    enabled: true,
  },
  {
    id: 'duo-practice',
    title: 'Ćwiczenie we dwoje',
    navLabel: 'We dwoje',
    group: 'practice',
    icon: UsersIcon,
    description: 'Usiądź ze znajomym jako para przeciwko dwóm botom i przećwiczcie razem wybraną gałąź otwarć.',
    route: '/tools/duo-practice',
    enabled: true,
  },
  {
    id: 'play-vs-ai',
    title: 'Gra z AI',
    navLabel: 'Gra z AI',
    description: 'Rozegraj licytację i rozgrywkę przeciwko silnikowi Trumpfish. W przygotowaniu.',
    route: '/tools/play',
    enabled: false,
  },
  {
    id: 'deal-analyzer',
    title: 'Analiza rozdania',
    navLabel: 'Analiza',
    description: 'Oceń rękę i rozkład, sprawdź sugestie systemu dla konkretnego rozdania. W przygotowaniu.',
    route: '/tools/analyzer',
    enabled: false,
  },
];
