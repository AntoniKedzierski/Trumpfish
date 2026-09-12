import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { duoRoute } from '@/features/duoPractice/route';
import { useRealtime } from '@/realtime/useRealtime';
import { AccountMenu } from './AccountMenu';
import { FriendsMenu } from './FriendsMenu';
import { ToolNav } from './ToolNav';
import { useFitsOnOneRow } from './useFitsOnOneRow';
import './AppLayout.css';

/**
 * The bar every signed in page sits under, and the one place table invitations can appear.
 */
/*
 * Shared rather than per page because an invitation has to reach whoever it was sent to wherever he happens to be - sitting in
 * the Bidding Browser is no reason to miss it - and because the hub connection behind it must outlive any single view.
 */
export function AppLayout() {
  const { user } = useAuth();
  const { invitations, acceptTableInvitation, declineTableInvitation, table, notice } = useRealtime();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const bar = useRef<HTMLElement>(null);

  // Whether the bar can still line its controls up. Measured, so adding a tool moves the answer on its own.
  const fits = useFitsOnOneRow(bar);

  // Sitting down happens on the server, so the client follows the table rather than the other way round: whoever accepts is
  // taken to it, and so is the host the moment his invitation is answered.
  useEffect(() => {
    if (table !== null && location.pathname !== duoRoute) {
      void navigate(duoRoute);
    }
  }, [table, location.pathname, navigate]);

  const answer = (operation: Promise<void>) => {
    setError(null);
    operation.catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)));
  };

  return (
    <div className="app-shell">
      <header className="app-bar" ref={bar}>
        <Link to="/" className="app-brand">
          <img src="/images/card_icon.png" alt="" />
          <span>Trumpfish</span>
        </Link>

        {/* The tabs give way first: the account and the invitations have to stay reachable, and they are the narrower two. */}
        <ToolNav collapsed={!fits} />

        <div className="app-bar-right">
          <FriendsMenu />
          {user === null ? null : <AccountMenu user={user} />}
        </div>
      </header>

      {invitations.map((invitation) => (
        <div key={invitation.id} className="app-invitation">
          <div>
            <strong>{invitation.fromName}</strong> zaprasza cię do wspólnego ćwiczenia licytacji.
            <small>
              {invitation.systemName}
              {invitation.openingLabel === null || invitation.openingLabel === undefined ? ' · wszystkie otwarcia' : ` · ${invitation.openingLabel}`}
            </small>
          </div>
          <div className="app-invitation-actions">
            <button type="button" className="primary" onClick={() => answer(acceptTableInvitation(invitation.id))}>Dołącz</button>
            <button type="button" onClick={() => answer(declineTableInvitation(invitation.id))}>Odrzuć</button>
          </div>
        </div>
      ))}

      {/* A remark that belongs to no page - an invitation turned down, say. The table page shows its own, so it is left alone. */}
      {error === null && (notice === null || location.pathname === duoRoute) ? null : (
        <div className="app-notice">{error ?? notice}</div>
      )}

      <Outlet />
    </div>
  );
}
