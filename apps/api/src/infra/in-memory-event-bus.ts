import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { TicketStreamEvent } from '@queue/shared';
import { EventBus } from './event-bus';

/**
 * In-process EventBus for the PoC (single instance, no Redis).
 * Each client gets a hot Subject; SSE controllers subscribe to it.
 */
@Injectable()
export class InMemoryEventBus implements EventBus {
  private readonly channels = new Map<string, Subject<TicketStreamEvent>>();

  publish(clientId: string, event: TicketStreamEvent): void {
    this.channelFor(clientId).next(event);
  }

  subscribe(clientId: string): Observable<TicketStreamEvent> {
    return this.channelFor(clientId).asObservable();
  }

  private channelFor(clientId: string): Subject<TicketStreamEvent> {
    let subject = this.channels.get(clientId);
    if (!subject) {
      subject = new Subject<TicketStreamEvent>();
      this.channels.set(clientId, subject);
    }
    return subject;
  }
}
