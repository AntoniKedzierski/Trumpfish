import { Fragment, useId } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import type { NavEntry, ToolDescriptor, ToolGroup } from '@/tools/toolsRegistry';
import { buildNavEntries } from '@/tools/toolsRegistry';
import { MenuIcon } from './icons';
import { Chevron } from './Select';
import { useDisclosure } from './useDisclosure';
import './menu.css';
import './ToolNav.css';

/** A tool is current on its own route and on anything beneath it, so managing systems keeps the Bidding Browser lit. */
function covers(route: string, pathname: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

/**
 * The tool navigation in the top bar: every tool reachable from every other one, with the current one marked.
 *
 * Where the bar has no room for the tabs they fold into one button - `collapsed` is decided by measuring the bar, not by
 * asking how wide the screen is.
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
 * tabs to save. Its members are reached in one tap like everything else, and a rule above them is all that is left of the
 * group - each of them is named in full, so a heading would only say a word they both already start with.
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
                <entry.tool.icon />
                <span>{entry.tool.navLabel}</span>
              </NavLink>
            ) : (
              <Fragment key={entry.group.id}>
                <div className="menu-separator" />
                {entry.tools.map((tool) => {
                  const Glyph = tool.icon;

                  return (
                    <NavLink key={tool.id} to={tool.route} onClick={() => setOpen(false)}>
                      <Glyph />
                      <span>{tool.navLabel}</span>
                    </NavLink>
                  );
                })}
              </Fragment>
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
