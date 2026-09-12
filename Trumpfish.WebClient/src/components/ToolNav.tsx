import { useId } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import type { ToolDescriptor, ToolGroup } from '@/tools/toolsRegistry';
import { toolGroups, tools } from '@/tools/toolsRegistry';
import { MenuIcon } from './icons';
import { Chevron } from './Select';
import { useDisclosure } from './useDisclosure';
import './menu.css';
import './ToolNav.css';

type NavEntry =
  | { kind: 'tool'; tool: ToolDescriptor }
  | { kind: 'group'; group: ToolGroup; tools: ToolDescriptor[] };

/** A tool is current on its own route and on anything beneath it, so managing systems keeps the Bidding Browser lit. */
function covers(route: string, pathname: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

/*
 * Only tools that are actually built are listed; the rest stay on the start page, which has the room to say that they are
 * still coming. Grouped tools collapse into one entry where the first of them would have stood - and a group left with a
 * single enabled tool is not a group at all, so it degrades back into a plain link rather than a menu of one.
 */
function buildEntries(): NavEntry[] {
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

/**
 * The tool navigation in the top bar: every tool reachable from every other one, with the current one marked.
 *
 * Where the bar has no room for the tabs they fold into one button - `collapsed` is decided by measuring the bar, not by
 * asking how wide the screen is.
 */
export function ToolNav({ collapsed = false }: { collapsed?: boolean }) {
  const entries = buildEntries();

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
          // `NavLink` marks the current entry with `aria-current`, which is what both the styling and a screen reader read.
          <NavLink key={entry.tool.id} to={entry.tool.route}>
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
 * Every tool in one panel, for a bar too narrow to line them up.
 */
/*
 * Flattened rather than nested: a group exists on the bar to keep four tabs from becoming seven, and here there are no
 * tabs to save. Its name stays as a heading, because "Ćwiczenie" is what tells the two practice screens apart from each
 * other, but its members are reached in one tap like everything else rather than in two.
 */
function ToolNavMenu({ entries }: { entries: NavEntry[] }) {
  const { pathname } = useLocation();
  const { open, setOpen, root, trigger } = useDisclosure<HTMLDivElement>();
  const panelId = useId();

  const currentLabel = entries
    .flatMap((entry) => (entry.kind === 'tool' ? [entry.tool] : entry.tools))
    .find((tool) => covers(tool.route, pathname))?.navLabel;

  return (
    <div className="app-nav-group" ref={root}>
      <button
        type="button"
        ref={trigger}
        className="app-nav-trigger app-nav-burger"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Narzędzia"
        onClick={() => setOpen((was) => !was)}
      >
        <MenuIcon />
        {/* Which tool is open, while there is room for the word. Below that the icon carries it alone. */}
        {currentLabel === undefined ? null : <span className="app-nav-burger-label">{currentLabel}</span>}
      </button>

      {!open ? null : (
        <div className="menu-panel app-nav-panel" id={panelId}>
          {entries.map((entry) =>
            entry.kind === 'tool' ? (
              <NavLink key={entry.tool.id} to={entry.tool.route} onClick={() => setOpen(false)}>
                {entry.tool.icon === undefined ? null : <entry.tool.icon />}
                <span>{entry.tool.navLabel}</span>
              </NavLink>
            ) : (
              <div key={entry.group.id} className="app-nav-section">
                <h4>{entry.group.label}</h4>
                {entry.tools.map((tool) => {
                  const Glyph = tool.icon;

                  return (
                    <NavLink key={tool.id} to={tool.route} onClick={() => setOpen(false)}>
                      {Glyph === undefined ? null : <Glyph />}
                      <span>{tool.navLabel}</span>
                    </NavLink>
                  );
                })}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

/*
 * A disclosure rather than a menu: the panel holds ordinary links, so Tab walks them in the order they are drawn and no
 * arrow-key handling has to be invented. Claiming `aria-haspopup="menu"` here would promise a keyboard contract that plain
 * links do not honour.
 */
function ToolNavGroup({ group, tools: members }: { group: ToolGroup; tools: ToolDescriptor[] }) {
  const { pathname } = useLocation();
  const { open, setOpen, root, trigger } = useDisclosure<HTMLDivElement>();
  const panelId = useId();

  const current = members.some((tool) => covers(tool.route, pathname));

  return (
    <div className="app-nav-group" ref={root}>
      <button
        type="button"
        ref={trigger}
        className="app-nav-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        aria-current={current ? 'true' : undefined}
        onClick={() => setOpen((was) => !was)}
      >
        <span>{group.label}</span>
        <Chevron className="app-nav-chevron" />
      </button>

      {!open ? null : (
        <div className="menu-panel app-nav-panel" id={panelId}>
          {members.map((tool) => {
            const Glyph = tool.icon;

            return (
              // Picking a tool is reason enough to put the panel away; anything else the user clicks closes it as an outside click.
              <NavLink key={tool.id} to={tool.route} onClick={() => setOpen(false)}>
                {Glyph === undefined ? null : <Glyph />}
                <span>{tool.navLabel}</span>
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
}
