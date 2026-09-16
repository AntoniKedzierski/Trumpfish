import { Fragment, useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import type { CurrentUser } from '@/api/models';
import { useAuth } from '@/auth/useAuth';
import type { ToolDescriptor } from '@/tools/toolsRegistry';
import { buildNavEntries } from '@/tools/toolsRegistry';
import { FriendsMenu } from './FriendsMenu';
import { CloseIcon, LayersIcon, LogOutIcon, MenuIcon, UserIcon } from './icons';
import './AppDrawer.css';

/**
 * Everything the top bar holds on a wide screen, behind one button on a narrow one.
 */
/*
 * A phone has room for the brand and one control, not for four tabs, the friends and the account - and a bar that wraps
 * onto a second row costs the page a line of height on every view. So the bar keeps what says where you are, and the panel
 * takes what says where you can go.
 *
 * It comes in from the left and covers the page rather than pushing it, because there is nothing on a phone to push it
 * into. Rendered into the body: the bar above sets `backdrop-filter`, which makes it the containing block for anything
 * fixed inside it, and a drawer anchored to a bar is a drawer the height of that bar.
 */
export function AppDrawer({ user }: { user: CurrentUser | null }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const entries = buildNavEntries();
  const close = () => setOpen(false);

  /*
   * Arriving somewhere is what the panel was opened for, so it closes on its own - including where the route changed
   * without anything in here having been clicked. Read while rendering rather than in an effect, so the panel is gone on
   * the render that changes the route instead of on the one after it.
   */
  const [at, setAt] = useState(pathname);
  if (at !== pathname) {
    setAt(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    // The page underneath holds still while the panel is over it.
    const scroll = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = scroll;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Nothing is lost by signing out and signing back in, so nothing is gained by asking first.
  const signOut = () => {
    setOpen(false);
    void logout().finally(() => void navigate('/login', { replace: true }));
  };

  return (
    <>
      <button
        type="button"
        className="app-drawer-burger"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Menu"
        onClick={() => setOpen((was) => !was)}
      >
        <MenuIcon />
      </button>

      {!open
        ? null
        : createPortal(
            <div className="app-drawer-backdrop" onClick={close}>
              {/* The panel is not the backdrop: a tap inside it is a choice, not a dismissal. */}
              <aside
                id={panelId}
                className="app-drawer"
                role="dialog"
                aria-modal="true"
                aria-label="Menu"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="app-drawer-head">
                  <span className="app-drawer-user">
                    <UserIcon />
                    <span className="name">{user === null ? 'Trumpfish' : user.displayName ?? user.username}</span>
                    {user?.isAdmin ? <span className="role">Admin</span> : null}
                  </span>

                  <button type="button" className="app-drawer-close" aria-label="Zamknij" onClick={close}>
                    <CloseIcon />
                  </button>
                </div>

                <nav className="app-drawer-nav" aria-label="Narzędzia">
                  {entries.map((entry) =>
                    entry.kind === 'tool' ? (
                      <DrawerLink key={entry.tool.id} to={entry.tool.route} icon={entry.tool.icon} label={entry.tool.navLabel} onPick={close} />
                    ) : (
                      /*
                       * A group is one tab on the bar because the bar has no room for two. Here there is room, so its tools
                       * stand on their own rows like every other tool, and a rule above them is all that is left of the
                       * heading they used to be filed under.
                       */
                      <Fragment key={entry.group.id}>
                        <div className="app-drawer-rule" />
                        {entry.tools.map((tool) => (
                          <DrawerLink key={tool.id} to={tool.route} icon={tool.icon} label={tool.navLabel} onPick={close} />
                        ))}
                      </Fragment>
                    ),
                  )}
                </nav>

                <div className="app-drawer-rule" />

                {/* The same menu as on a wide screen; here its panel opens in place rather than hanging off the bar. */}
                <div className="app-drawer-friends">
                  <FriendsMenu />
                </div>

                <div className="app-drawer-rule" />

                <nav className="app-drawer-nav" aria-label="Konto">
                  <DrawerLink to="/account" icon={UserIcon} label="Konto" onPick={close} />
                  <DrawerLink to="/tools/bidding-browser/systems" icon={LayersIcon} label="Zarządzaj systemami" onPick={close} />
                </nav>

                <div className="app-drawer-rule" />

                <button type="button" className="app-drawer-leave" onClick={signOut}>
                  <LogOutIcon />
                  <span>Wyloguj</span>
                </button>
              </aside>
            </div>,
            document.body,
          )}
    </>
  );
}

/** One row of the panel: a glyph, a name, and the same height wherever it stands. */
function DrawerLink({ to, icon: Glyph, label, onPick }: { to: string; icon: ToolDescriptor['icon']; label: string; onPick: () => void }) {
  return (
    <NavLink to={to} end onClick={onPick}>
      <Glyph />
      <span>{label}</span>
    </NavLink>
  );
}
