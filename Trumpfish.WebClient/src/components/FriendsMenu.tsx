import { useCallback, useState } from 'react';
import { acceptFriend, inviteFriend, removeFriend } from '@/api/friends';
import type { FriendPresence, FriendSummary } from '@/api/models';
import { useRealtime } from '@/realtime/useRealtime';
import { Button, PanelNote, PanelSection, Popup, TextBox } from '@/ui';
import { CheckIcon, CloseIcon, PlusIcon, TrashIcon, UsersIcon } from './icons';
import './FriendsMenu.css';

const presenceLabels: Record<FriendPresence, string> = {
  Online: 'dostępny',
  Busy: 'przy stole',
  Offline: 'niedostępny',
};

/**
 * Znajomi w górnym pasku: kto jest w pobliżu, kto czeka pod drzwiami i pole, żeby zaprosić kogoś nowego.
 */
/*
 * Dostępność przychodzi po hubie, więc kropki zmieniają się bez otwierania panelu i bez odpytywania serwera.
 *
 * W szufladzie ten sam komponent otwiera się w miejscu: nie ma tam paska, z którego mógłby zwisać, ani miejsca obok
 * szuflady, w które mógłby się wysunąć.
 */
export function FriendsMenu({ variant = 'bar' }: { variant?: 'bar' | 'drawer' }) {
  const { friends, refreshFriends, connection } = useRealtime();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const drop = (friendshipId: string) => () => void run(async () => {
    await removeFriend(friendshipId);
    await refreshFriends();
  });

  const incoming = friends?.incoming ?? [];
  const outgoing = friends?.outgoing ?? [];
  const mine = friends?.friends ?? [];
  const online = mine.filter((friend) => friend.presence !== 'Offline').length;

  return (
    <Popup
      label="Znajomi"
      icon={UsersIcon}
      size="large"
      align="end"
      panelClassName="friends-panel"
      inline={variant === 'drawer'}
      triggerClassName={variant === 'drawer' ? 'ui-row large' : 'app-bar-chip'}
      badges={
        <>
          {online === 0 ? null : <span className="ui-badge">{online}</span>}
          {incoming.length === 0 ? null : <span className="ui-badge pending">{incoming.length}</span>}
        </>
      }
    >
      {connection === 'connected' ? null : <PanelNote>Brak połączenia z serwerem — dostępność może być nieaktualna.</PanelNote>}

      <div className="friends-add">
        <TextBox value={name} placeholder="nazwa użytkownika" onChange={setName} onSubmit={invite} />
        <Button size="small" icon={PlusIcon} onClick={invite} disabled={busy || name.trim() === ''}>Zaproś</Button>
      </div>

      {error === null ? null : <PanelNote className="friends-error">{error}</PanelNote>}

      {incoming.length === 0 ? null : (
        <PanelSection>
          <h3>Zaproszenia</h3>
          {incoming.map((friend) => (
            <Row key={friend.friendshipId} friend={friend}>
              <Button size="small" icon={CheckIcon} disabled={busy} onClick={() => void run(async () => { await acceptFriend(friend.friendshipId); await refreshFriends(); })}>Przyjmij</Button>
              <Button size="small" icon={CloseIcon} disabled={busy} onClick={drop(friend.friendshipId)}>Odrzuć</Button>
            </Row>
          ))}
        </PanelSection>
      )}

      {outgoing.length === 0 ? null : (
        <PanelSection>
          <h3>Wysłane</h3>
          {outgoing.map((friend) => (
            <Row key={friend.friendshipId} friend={friend}>
              <Button size="small" icon={CloseIcon} disabled={busy} onClick={drop(friend.friendshipId)}>Anuluj</Button>
            </Row>
          ))}
        </PanelSection>
      )}

      <PanelSection>
        <h3>Znajomi</h3>
        {mine.length === 0 ? (
          <PanelNote>Nikogo tu jeszcze nie ma. Zaproś kogoś po nazwie użytkownika.</PanelNote>
        ) : (
          mine.map((friend) => (
            <Row key={friend.friendshipId} friend={friend} showPresence>
              <Button size="small" icon={TrashIcon} disabled={busy} onClick={drop(friend.friendshipId)}>Usuń</Button>
            </Row>
          ))
        )}
      </PanelSection>
    </Popup>
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
