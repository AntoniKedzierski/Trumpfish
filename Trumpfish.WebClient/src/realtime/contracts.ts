import type { DuoTableState } from '@/api/models';

/**
 * Payloads that only ever travel over the hub, so they are not in the generated OpenAPI models and have to be declared here.
 * They mirror `DuoEnded` and `DuoNotice` on the server; keep the two in step.
 */

/** Why a session stopped, which is what the other player is shown when it was not his doing. */
export type DuoEndReason = 'Finished' | 'PartnerLeft' | 'PartnerLost';

export interface DuoEnded {
  sessionId: string;
  reason: DuoEndReason;
  message: string;
}

export interface DuoNotice {
  sessionId: string;
  message: string;
}

/** What the hub calls on the client. Written out so the connection wiring cannot mistype an event name. */
export interface TableEvents {
  friendsChanged: () => void;
  presenceChanged: (userId: string, presence: string) => void;
  tableInvitation: (invitation: unknown) => void;
  tableInvitationWithdrawn: (invitationId: string, message: string | null) => void;
  table: (state: DuoTableState) => void;
  tableNotice: (notice: DuoNotice) => void;
  tableEnded: (ended: DuoEnded) => void;
}
