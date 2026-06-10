/**
 * Shared contracts between the NestJS API and the React web app.
 * Keep this package free of any China-service / platform-specific assumptions
 * so the queue service stays globally reusable (see design.md §1.5).
 */

/** Lifecycle of a queue ticket. Mirrors the state machine in design.md §3.4. */
export enum TicketStatus {
  /** Waiting in the queue. */
  WAITING = 'WAITING',
  /** Promoted into the Ready Pool — "it's your turn / please go to area X". */
  READY = 'READY',
  /** A staff member has started serving this ticket. */
  SERVING = 'SERVING',
  /** Service completed (triggers an auto-refill of the Ready Pool). */
  DONE = 'DONE',
  /** Missed (no response while READY). Can be recalled by staff. */
  MISSED = 'MISSED',
  /** Abandoned by the user, or cleared on store reset. */
  CANCELLED = 'CANCELLED',
}

/** Statuses that still occupy a place in the live queue. */
export const ACTIVE_STATUSES: TicketStatus[] = [
  TicketStatus.WAITING,
  TicketStatus.READY,
  TicketStatus.SERVING,
];

/** Fixed Ready Pool buffer for the PoC (capacity = staffCount + BUFFER). design.md §2.4 */
export const READY_POOL_BUFFER = 1;

/** A ticket as exposed to clients (no internal-only fields). */
export interface TicketView {
  id: string;
  storeId: string;
  number: number;
  status: TicketStatus;
  /** How many people are ahead while WAITING (0 when it's your turn). */
  peopleAhead: number;
  createdAt: string;
}

/** Public store info safe to expose to the user web page. */
export interface StoreView {
  id: string;
  name: string;
  timezone: string;
  staffCount: number;
}

/** Admin-facing live queue snapshot. */
export interface AdminQueueView {
  store: StoreView;
  capacity: number;
  /** Signed scan URL encoded by the store's printable static QR (design.md §2.9). */
  scanUrl: string;
  tickets: AdminTicketView[];
}

export interface AdminTicketView extends TicketView {
  calledAt: string | null;
  servedAt: string | null;
}

/** SSE event payload pushed to a single client's stream. */
export interface TicketStreamEvent {
  ticket: TicketView | null;
}

/** Request body for taking a ticket (scan → take). */
export interface CreateTicketRequest {
  storeId: string;
  sig: string;
}
