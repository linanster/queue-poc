import { Controller, MessageEvent, Query, Req, Sse } from '@nestjs/common';
import type { Request } from 'express';
import { Observable, merge, of, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { Inject } from '@nestjs/common';
import { TicketStreamEvent } from '@queue/shared';
import { EVENT_BUS, EventBus } from '../infra/event-bus';
import { QueueService } from './queue.service';
import { CLIENT_COOKIE } from '../common/client-cookie';

/**
 * Server-Sent Events stream of a single client's ticket state (design.md §2.3).
 * On connect it emits the current snapshot, then streams live updates.
 */
@Controller('api/tickets')
export class SseController {
  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
    private readonly queue: QueueService,
  ) {}

  @Sse('me/stream')
  stream(
    @Query('storeId') storeId: string,
    @Req() req: Request,
  ): Observable<MessageEvent> {
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
    const clientId = cookies?.[CLIENT_COOKIE] ?? null;

    if (!clientId) {
      return of({ data: { ticket: null } as TicketStreamEvent });
    }

    const initial$ = from(this.queue.getLatestTicket(storeId, clientId)).pipe(
      map((ticket): TicketStreamEvent => ({ ticket })),
    );

    const updates$ = this.eventBus.subscribe(clientId);

    return merge(initial$, updates$).pipe(map((event) => ({ data: event })));
  }
}
