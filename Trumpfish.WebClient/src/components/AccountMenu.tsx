import { NavLink, useNavigate } from 'react-router-dom';
import type { CurrentUser } from '@/api/models';
import { useAuth } from '@/auth/useAuth';
import { LayersIcon, LogOutIcon, SaveIcon, ShareIcon, UserIcon } from './icons';
import { Chevron } from './Select';
import { useDisclosure } from './useDisclosure';
import './menu.css';
import './AccountMenu.css';

/** Everything the signed in user owns: the account itself, and the systems that belong to him rather than to a tool. */
const entries = [
  { to: '/account', label: 'Konto', Glyph: UserIcon },
  { to: '/tools/bidding-browser/systems', label: 'Zarządzaj systemami', Glyph: LayersIcon },
  { to: '/account/deals', label: 'Zapisane rozdania', Glyph: SaveIcon },
  { to: '/account/deals/shared', label: 'Udostępnione rozdania', Glyph: ShareIcon },
];

/**
 * The account in the top bar. It used to be a plain link to the account page; it opens now, because managing one's own
 * bidding systems belongs to the user rather than to the Bidding Browser, and the browser's header was the wrong place to
 * keep it once that header went.
 */
export function AccountMenu({ user }: { user: CurrentUser }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { open, setOpen, root, trigger } = useDisclosure<HTMLDivElement>();

  // Nothing is lost by signing out and signing back in, so nothing is gained by asking first.
  const signOut = () => {
    setOpen(false);
    void logout().finally(() => void navigate('/login', { replace: true }));
  };

  return (
    <div className="account-menu" ref={root}>
      <button
        type="button"
        ref={trigger}
        className="account-chip"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
      >
        <UserIcon />
        <span className="name">{user.displayName ?? user.username}</span>
        {/* Being an administrator is worth a word; merely having an account is not, and the chip already says it. */}
        {user.isAdmin ? <span className="role">Admin</span> : null}
        <Chevron className="account-chevron" />
      </button>

      {!open ? null : (
        <div className="menu-panel account-panel">
          {entries.map(({ to, label, Glyph }) => (
            // Picking something is reason enough to put the panel away; anything else the user clicks closes it as an outside click.
            <NavLink key={to} to={to} end onClick={() => setOpen(false)}>
              <Glyph />
              <span>{label}</span>
            </NavLink>
          ))}

          <div className="menu-separator" />

          <button type="button" className="menu-leave" onClick={signOut}>
            <LogOutIcon />
            <span>Wyloguj</span>
          </button>
        </div>
      )}
    </div>
  );
}
