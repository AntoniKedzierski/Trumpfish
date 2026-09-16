import { Fragment } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import type { NavEntry, ToolDescriptor, ToolGroup } from '@/tools/toolsRegistry';
import { buildNavEntries } from '@/tools/toolsRegistry';
import { NavRow, PanelSeparator, Popup } from '@/ui';
import { MenuIcon } from './icons';
import './ToolNav.css';

/** Narzędzie jest bieżące na swojej trasie i na wszystkim pod nią, więc zarządzanie systemami trzyma zapaloną przeglądarkę. */
function covers(route: string, pathname: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

/**
 * Nawigacja narzędzi w górnym pasku: każde narzędzie osiągalne z każdego innego, z zaznaczonym bieżącym.
 *
 * Gdy pasek nie ma miejsca na zakładki, składają się w jeden przycisk - `collapsed` jest wynikiem pomiaru paska, a nie
 * pytania o szerokość ekranu.
 */
export function ToolNav({ collapsed = false }: { collapsed?: boolean }) {
  const entries = buildNavEntries();

  if (collapsed) {
    return (
      <nav className="app-nav collapsed" aria-label="Narzędzia">
        <ToolNavMenu entries={entries} />
      </nav>
    );
  }

  return (
    <nav className="app-nav" aria-label="Narzędzia">
      {entries.map((entry) =>
        entry.kind === 'tool' ? (
          // `NavLink` znaczy bieżącą pozycję przez `aria-current`, i to czyta zarówno styl, jak i czytnik ekranu.
          <NavLink key={entry.tool.id} to={entry.tool.route} className="ui-tab">
            {entry.tool.navLabel}
          </NavLink>
        ) : (
          <ToolNavGroup key={entry.group.id} group={entry.group} tools={entry.tools} />
        ),
      )}
    </nav>
  );
}

/**
 * Wszystkie narzędzia w jednym panelu, dla paska za wąskiego, żeby je ustawić w rzędzie.
 */
/*
 * Spłaszczone, nie zagnieżdżone: grupa istnieje na pasku po to, żeby cztery zakładki nie stały się siedmioma, a tutaj
 * nie ma zakładek do oszczędzania. Kreska nad jej pozycjami jest wszystkim, co z grupy zostaje.
 */
function ToolNavMenu({ entries }: { entries: NavEntry[] }) {
  const { pathname } = useLocation();

  const currentLabel = entries
    .flatMap((entry) => (entry.kind === 'tool' ? [entry.tool] : entry.tools))
    .find((tool) => covers(tool.route, pathname))?.navLabel;

  return (
    // Wyzwalacz niesie nazwę otwartego narzędzia - to robota, którą wykonywała zapalona zakładka.
    <Popup label={currentLabel ?? 'Narzędzia'} icon={MenuIcon} size="large" triggerClassName="app-nav-trigger">
      {(close) => (
        <>
          {entries.map((entry) =>
            entry.kind === 'tool' ? (
              <NavRow key={entry.tool.id} to={entry.tool.route} icon={entry.tool.icon} onClick={close}>
                {entry.tool.navLabel}
              </NavRow>
            ) : (
              <Fragment key={entry.group.id}>
                <PanelSeparator />
                {entry.tools.map((tool) => (
                  <NavRow key={tool.id} to={tool.route} icon={tool.icon} onClick={close}>
                    {tool.navLabel}
                  </NavRow>
                ))}
              </Fragment>
            ),
          )}
        </>
      )}
    </Popup>
  );
}

/** Grupa narzędzi jako jedna zakładka, bo pasek nie ma miejsca na dwie. */
function ToolNavGroup({ group, tools: members }: { group: ToolGroup; tools: ToolDescriptor[] }) {
  const { pathname } = useLocation();
  const current = members.some((tool) => covers(tool.route, pathname));

  return (
    <Popup
      label={group.label}
      size="large"
      triggerClassName={current ? 'app-nav-trigger current' : 'app-nav-trigger'}
    >
      {(close) =>
        members.map((tool) => (
          <NavRow key={tool.id} to={tool.route} icon={tool.icon} onClick={close}>
            {tool.navLabel}
          </NavRow>
        ))
      }
    </Popup>
  );
}
