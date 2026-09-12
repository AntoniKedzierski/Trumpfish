import { HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection } from '@microsoft/signalr';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getTable, listTableInvitations } from '@/api/duo';
import { listFriends } from '@/api/friends';
import type { DuoInvitation, DuoSettings, DuoTableState, FriendsView, PracticeHint } from '@/api/models';
import { useAuth } from '@/auth/useAuth';
import type { DuoEnded, DuoNotice } from './contracts';
import { RealtimeContext, type ConnectionState, type RealtimeContextValue } from './realtimeContext';

/**
 * The single hub connection the whole application shares, opened as soon as somebody is signed in and closed when they are not.
 */
/*
 * Closing it is not merely tidiness: the server treats a closed connection as the person having left, which is exactly what
 * ends a two-player session. That is why there is one connection for the application rather than one per page - a page that
 * owned its own would end the session every time the user looked at something else.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const hub = useRef<HubConnection | null>(null);

  // Starts as connecting rather than disconnected: with somebody signed in, a connection is always on its way up.
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [friends, setFriends] = useState<FriendsView | null>(null);
  const [invitations, setInvitations] = useState<DuoInvitation[]>([]);
  const [table, setTable] = useState<DuoTableState | null>(null);
  const [ended, setEnded] = useState<DuoEnded | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refreshFriends = useCallback(async () => {
    setFriends(await listFriends());
  }, []);

  useEffect(() => {
    if (user === null) {
      return;
    }

    let cancelled = false;
    const started = new HubConnectionBuilder()
      .withUrl('/hubs/table')
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .configureLogging(LogLevel.Warning)
      .build();

    started.on('friendsChanged', () => { void refreshFriends(); });

    // Only one field of one entry changed, so the list is patched in place rather than fetched again.
    started.on('presenceChanged', (userId: string, presence: FriendsView['friends'][number]['presence']) => {
      setFriends((current) => current === null ? current : {
        ...current,
        friends: current.friends.map((friend) => (friend.userId === userId ? { ...friend, presence } : friend)),
      });
    });

    started.on('tableInvitation', (invitation: DuoInvitation) => {
      setInvitations((current) => [...current.filter((candidate) => candidate.id !== invitation.id), invitation]);
    });

    started.on('tableInvitationWithdrawn', (invitationId: string, message: string | null) => {
      setInvitations((current) => current.filter((candidate) => candidate.id !== invitationId));
      if (message !== null) {
        setNotice(message);
      }
    });

    started.on('table', (state: DuoTableState) => {
      setTable(state);
      setEnded(null);
      setNotice(null);
    });

    started.on('tableNotice', (received: DuoNotice) => { setNotice(received.message); });

    started.on('tableEnded', (received: DuoEnded) => {
      setTable(null);
      setNotice(null);
      setEnded(received);
    });

    started.onreconnecting(() => { if (!cancelled) { setConnection('connecting'); } });
    started.onreconnected(() => { if (!cancelled) { setConnection('connected'); } });
    started.onclose(() => { if (!cancelled) { setConnection('disconnected'); } });

    hub.current = started;

    started.start().then(
      async () => {
        if (cancelled) {
          return;
        }

        setConnection('connected');

        // Whatever arrived before this page existed: a reload lands here, and so does a first visit.
        await Promise.all([
          refreshFriends(),
          listTableInvitations().then(setInvitations),
          getTable().then(setTable),
        ]);
      },
      () => { if (!cancelled) { setConnection('disconnected'); } },
    );

    // Signing out - or simply unmounting - takes the connection down with everything it was carrying, so none of it is left
    // behind for the next account to walk into.
    return () => {
      cancelled = true;
      hub.current = null;
      void started.stop();

      setConnection('connecting');
      setFriends(null);
      setInvitations([]);
      setTable(null);
      setNotice(null);
    };
  }, [user, refreshFriends]);

  /** Every hub call goes through here, so a call made while the connection is down fails with a readable message. */
  const invoke = useCallback(async <T,>(method: string, ...args: unknown[]): Promise<T> => {
    const current = hub.current;
    if (current === null || current.state !== HubConnectionState.Connected) {
      throw new Error('Brak połączenia z serwerem. Odczekaj chwilę i spróbuj ponownie.');
    }

    return current.invoke<T>(method, ...args);
  }, []);

  /**
   * Answering an invitation takes it off the screen at once rather than waiting for the server to say so. The server sends the
   * same withdrawal anyway - this only spares the banner a round trip of sitting there after it has been dealt with. Putting it
   * back on a failure keeps an invitation that was never actually answered from vanishing.
   */
  const answer = useCallback(async (method: string, invitationId: string) => {
    let removed: DuoInvitation | undefined;

    setInvitations((current) => {
      removed = current.find((candidate) => candidate.id === invitationId);
      return current.filter((candidate) => candidate.id !== invitationId);
    });

    try {
      await invoke<void>(method, invitationId);
    } catch (reason) {
      if (removed !== undefined) {
        const restored = removed;
        setInvitations((current) => (current.some((candidate) => candidate.id === restored.id) ? current : [...current, restored]));
      }

      throw reason;
    }
  }, [invoke]);

  const value = useMemo<RealtimeContextValue>(() => ({
    connection,
    friends,
    refreshFriends,
    invitations,
    table,
    ended,
    clearEnded: () => setEnded(null),
    notice,
    inviteToTable: (friendUserId: string, settings: DuoSettings) => invoke<void>('InviteToTable', friendUserId, settings),
    acceptTableInvitation: (invitationId: string) => answer('AcceptTableInvitation', invitationId),
    declineTableInvitation: (invitationId: string) => answer('DeclineTableInvitation', invitationId),
    bid: (type: string, color: string, bidValue: number | null) => invoke<void>('Bid', type, color, bidValue),
    requestHint: () => invoke<PracticeHint>('Hint'),
    nextDeal: () => invoke<void>('NextDeal'),
    endTable: () => invoke<void>('EndTable'),
  }), [connection, friends, refreshFriends, invitations, table, ended, notice, invoke, answer]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}
