import { useNavigate } from 'react-router-dom';
import type { CurrentUser } from '@/api/models';
import { useAuth } from '@/auth/useAuth';
import { MenuRow, NavRow, PanelSeparator, Popup } from '@/ui';
import { LayersIcon, LogOutIcon, SaveIcon, ShareIcon, UserIcon } from './icons';

/** Wszystko, co należy do zalogowanego: konto i systemy, które są jego, a nie narzędzia. */
const entries = [
  { to: '/account', label: 'Konto', Glyph: UserIcon },
  { to: '/tools/bidding-browser/systems', label: 'Zarządzaj systemami', Glyph: LayersIcon },
  { to: '/account/deals', label: 'Zapisane rozdania', Glyph: SaveIcon },
  { to: '/account/deals/shared', label: 'Udostępnione rozdania', Glyph: ShareIcon },
];

/**
 * Konto w górnym pasku.
 */
/*
 * Ten sam komponent panelu co znajomi obok - wcześniej były to dwie osobne implementacje i dwie różne skale pisma, co w
 * nagłówku widać było gołym okiem, bo panele stały dwa centymetry od siebie.
 */
export function AccountMenu({ user }: { user: CurrentUser }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  // Nic się nie traci przez wylogowanie i ponowne zalogowanie, więc nic się nie zyskuje na pytaniu.
  const signOut = () => {
    void logout().finally(() => void navigate('/login', { replace: true }));
  };

  return (
    <Popup
      label={user.displayName ?? user.username}
      icon={UserIcon}
      size="large"
      align="end"
      triggerClassName="app-bar-chip"
      // Bycie administratorem jest warte słowa; samo posiadanie konta nie jest, a wyzwalacz już to mówi.
      badges={user.isAdmin ? <span className="ui-badge quiet">Admin</span> : null}
    >
      {(close) => (
        <>
          {entries.map(({ to, label, Glyph }) => (
            <NavRow key={to} to={to} icon={Glyph} onClick={close}>
              {label}
            </NavRow>
          ))}

          <PanelSeparator />

          <MenuRow icon={LogOutIcon} leave onClick={signOut}>Wyloguj</MenuRow>
        </>
      )}
    </Popup>
  );
}
