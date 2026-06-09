import { Observable } from 'rxjs';
import { TicketStreamEvent } from '@queue/shared';

/**
 * Abstraction over per-client real-time push (design.md §3.1.1).
 * PoC provides an in-process implementation; production swaps in a
 * Redis-backed pub/sub without touching business logic.
 */
export interface EventBus {
  /** Publish the latest ticket snapshot for a given client. */
  publish(clientId: string, event: TicketStreamEvent): void;

  /** Subscribe to a client's ticket stream (used by SSE). */
  subscribe(clientId: string): Observable<TicketStreamEvent>;
}

export const EVENT_BUS = Symbol('EVENT_BUS');
