import { useCallback, useEffect, useRef, useState } from 'react';
import { acceptFriend, inviteFriend, removeFriend } from '@/api/friends';
import type { FriendPresence, FriendSummary } from '@/api/models';
import { useRealtime } from '@/realtime/useRealtime';
import { UsersIcon } from './icons';
import './FriendsMenu.css';

const presenceLabels: Record<FriendPresence, string> = {
  Online: 'dostępny',
  Busy: 'przy stole',
  Offline: 'niedostępny',
};

/**
 * The friends dropdown in the top bar: who is around, who is waiting to be let in, and the box for asking somebody new.
 * Presence arrives over the hub, so the dots change without the panel being open or anything being polled.
 */
export function FriendsMenu() {
  const { friends, refreshFriends, connection } = useRealtime();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  // A dropdown that stays open after a click elsewhere is a dropdown in the way, so it closes on both a click out and Escape.
  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (root.current !== null && !root.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const run = useCallback(async (operation: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await operation();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }, []);

  const invite = () => {
    if (name.trim() === '') {
      return;
    }

    void run(async () => {
      await inviteFriend(name.trim());
      setName('');
      await refreshFriends();
    });
  };

  const incoming = friends?.incoming ?? [];
  const online = (friends?.friends ?? []).filter((friend) => friend.presence !== 'Offline').length;

  return (
    <div className="friends-menu" ref={root}>
      <button type="button" className="friends-trigger" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        <UsersIcon />
        <span>Znajomi</span>
        {online === 0 ? null : <span className="count online">{online}</span>}
        {incoming.length === 0 ? null : <span className="count pending">{incoming.length}</span>}
      </button>

      {!open ? null : (
        <div className="friends-panel">
          {connection === 'connected' ? null : <p className="friends-offline">Brak połączenia z serwerem — dostępność może być nieaktualna.</p>}

          <div className="friends-add">
            <input
              type="text"
              value={name}
              placeholder="nazwa użytkownika"
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') { invite(); } }}
            />
            <button type="button" onClick={invite} disabled={busy || name.trim() === ''}>Zaproś</button>
          </div>

          {error === null ? null : <p className="friends-error">{error}</p>}

          {incoming.length === 0 ? null : (
            <section>
              <h3>Zaproszenia</h3>
              {incoming.map((friend) => (
                <Row key={friend.friendshipId} friend={friend}>
                  <button type="button" onClick={() => void run(async () => { await acceptFriend(friend.friendshipId); await refreshFriends(); })} disabled={busy}>Przyjmij</button>
                  <button type="button" onClick={() => void run(async () => { await removeFriend(friend.friendshipId); await refreshFriends(); })} disabled={busy}>Odrzuć</button>
                </Row>
              ))}
            </section>
          )}

          {(friends?.outgoing ?? []).length === 0 ? null : (
            <section>
              <h3>Wysłane</h3>
              {(friends?.outgoing ?? []).map((friend) => (
                <Row key={friend.friendshipId} friend={friend}>
                  <button type="button" onClick={() => void run(async () => { await removeFriend(friend.friendshipId); await refreshFriends(); })} disabled={busy}>Anuluj</button>
                </Row>
              ))}
            </section>
          )}

          <section>
            <h3>Znajomi</h3>
            {(friends?.friends ?? []).length === 0 ? (
              <p className="friends-empty">Nikogo tu jeszcze nie ma. Zaproś kogoś po nazwie użytkownika.</p>
            ) : (
              (friends?.friends ?? []).map((friend) => (
                <Row key={friend.friendshipId} friend={friend} showPresence>
                  <button type="button" onClick={() => void run(async () => { await removeFriend(friend.friendshipId); await refreshFriends(); })} disabled={busy}>Usuń</button>
                </Row>
              ))
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Row({ friend, showPresence = false, children }: { friend: FriendSummary; showPresence?: boolean; children: React.ReactNode }) {
  return (
    <div className="friends-row">
      <span className={`dot ${friend.presence.toLowerCase()}`} title={presenceLabels[friend.presence]} />
      <span className="friends-name">
        {friend.displayName ?? friend.username}
        {showPresence ? <small>{presenceLabels[friend.presence]}</small> : null}
      </span>
      <span className="friends-actions">{children}</span>
    </div>
  );
}
