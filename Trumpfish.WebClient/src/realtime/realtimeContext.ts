import { createContext } from 'react';
import type { DuoInvitation, DuoSettings, DuoTableState, FriendsView, PracticeHint } from '@/api/models';
import type { DuoEnded } from './contracts';

/** Whether the live connection is up, which is what greys the friends list out when it is not. */
export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

export interface RealtimeContextValue {
  connection: ConnectionState;

  /** The friends list, kept fresh by the hub. Null until the first fetch settles. */
  friends: FriendsView | null;
  refreshFriends: () => Promise<void>;

  /** Table invitations waiting for an answer, newest last. */
  invitations: DuoInvitation[];

  /** The table this account is sitting at, or null. Replaced wholesale every time the server sends a new one. */
  table: DuoTableState | null;

  /** How the last session ended, kept after the table itself is gone so the closing screen has something to show. */
  ended: DuoEnded | null;
  clearEnded: () => void;

  /** A remark about the table that is not part of its state - that the partner dropped out, say. */
  notice: string | null;

  inviteToTable: (friendUserId: string, settings: DuoSettings) => Promise<void>;
  acceptTableInvitation: (invitationId: string) => Promise<void>;
  declineTableInvitation: (invitationId: string) => Promise<void>;
  bid: (type: string, color: string, value: number | null) => Promise<void>;
  requestHint: () => Promise<PracticeHint>;
  nextDeal: () => Promise<void>;
  endTable: () => Promise<void>;
}

/** Kept apart from the provider component so that file exports components only, which is what fast refresh needs. */
export const RealtimeContext = createContext<RealtimeContextValue | null>(null);
