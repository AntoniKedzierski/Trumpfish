import type { ComponentType } from 'react';
import { BotIcon, CardsIcon, LayersIcon, PlayIcon, SearchIcon, UsersIcon } from '@/components/icons';

export interface ToolDescriptor {
  id: string;
  /**
   * What the tool is called wherever it is offered - the tabs, the drawer and the cards on the start page all read this
   * one name. It carried a second, longer one for the start page, and a tool called two things is a tool the reader has
   * to work out is the same tool.
   */
  navLabel: string;
  description: string;
  route: string;
  enabled: boolean;
  /** Tools that answer the same question collapse into one entry in the top bar. Identifies which, if any. */
  group?: string;
  /** Drawn beside the name in every list of tools. Required: a list where some rows carry a glyph and some do not reads as an oversight. */
  icon: ComponentType<{ className?: string }>;
}

export interface ToolGroup {
  id: string;
  label: string;
}

/*
 * A group earns its place where the bar has no room to name both of its tools. Practising alone and practising with a
 * partner are the same errand, so the bar says "Ćwiczenie" once and lets the user pick a seat. Where there is room to list
 * them - the drawer, the start page - they are two tools like any other, set apart by a rule rather than filed under a
 * heading nobody asked for.
 */
export const toolGroups: ToolGroup[] = [{ id: 'practice', label: 'Ćwiczenie' }];

/** Adding a tool is a single entry here plus a route in `routes.tsx`; the start page and the top bar both read this list. */
export const tools: ToolDescriptor[] = [
  {
    id: 'bidding-browser',
    navLabel: 'Systemy',
    icon: LayersIcon,
    description: 'Twórz i edytuj systemy licytacyjne jako drzewo odzywek, waliduj je i zapisuj na serwerze.',
    route: '/tools/bidding-browser',
    enabled: true,
  },
  {
    id: 'simulation',
    navLabel: 'Symulacja',
    icon: CardsIcon,
    description: 'Wygeneruj rozdania, pozwól silnikowi rozegrać licytację i przejrzyj ręce, punkty oraz przebieg licytacji.',
    route: '/tools/simulation',
    enabled: true,
  },
  {
    id: 'bidding-practice',
    navLabel: 'Ćwiczenie z botami',
    group: 'practice',
    icon: BotIcon,
    description: 'Licytuj z trzema botami, jedno rozdanie na raz. Wybierz otwarcie do przećwiczenia, a karty rozdadzą się pod nie.',
    route: '/tools/practice',
    enabled: true,
  },
  {
    id: 'duo-practice',
    navLabel: 'Ćwiczenie z partnerem',
    group: 'practice',
    icon: UsersIcon,
    description: 'Usiądź ze znajomym jako para przeciwko dwóm botom i przećwiczcie razem wybraną gałąź otwarć.',
    route: '/tools/duo-practice',
    enabled: true,
  },
  {
    id: 'play-vs-ai',
    navLabel: 'Gra z AI',
    icon: PlayIcon,
    description: 'Rozegraj licytację i rozgrywkę przeciwko silnikowi Trumpfish. W przygotowaniu.',
    route: '/tools/play',
    enabled: false,
  },
  {
    id: 'deal-analyzer',
    navLabel: 'Analiza rozdania',
    icon: SearchIcon,
    description: 'Oceń rękę i rozkład, sprawdź sugestie systemu dla konkretnego rozdania. W przygotowaniu.',
    route: '/tools/analyzer',
    enabled: false,
  },
];

export type NavEntry =
  | { kind: 'tool'; tool: ToolDescriptor }
  | { kind: 'group'; group: ToolGroup; tools: ToolDescriptor[] };

/**
 * The tools as the navigation shows them: one entry per tool, and one entry per group of them.
 */
/*
 * Only tools that are actually built are listed; the rest stay on the start page, which has the room to say that they are
 * still coming. Grouped tools collapse into one entry where the first of them would have stood - and a group left with a
 * single enabled tool is not a group at all, so it degrades back into a plain link rather than a menu of one.
 */
export function buildNavEntries(): NavEntry[] {
  const entries: NavEntry[] = [];
  const done = new Set<string>();

  for (const tool of tools) {
    if (!tool.enabled) {
      continue;
    }

    if (tool.group === undefined) {
      entries.push({ kind: 'tool', tool });
      continue;
    }

    if (done.has(tool.group)) {
      continue;
    }

    done.add(tool.group);
    const group = toolGroups.find((candidate) => candidate.id === tool.group);
    const members = tools.filter((candidate) => candidate.enabled && candidate.group === tool.group);

    if (group === undefined || members.length < 2) {
      entries.push(...members.map((member): NavEntry => ({ kind: 'tool', tool: member })));
      continue;
    }

    entries.push({ kind: 'group', group, tools: members });
  }

  return entries;
}
