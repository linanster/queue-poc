import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ACTIVE_STATUSES,
  AdminQueueView,
  AdminTicketView,
  READY_POOL_BUFFER,
  TicketStatus,
  TicketView,
} from '@queue/shared';
import { Ticket } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QrSignatureService } from '../common/qr-signature.service';
import { EVENT_BUS, EventBus } from '../infra/event-bus';

/**
 * Core queue logic: anonymous take-a-ticket (idempotent), status queries,
 * the Ready Pool buffer model, and admin transitions.
 *
 * Single-instance PoC: all mutations run serially in this process, so the
 * Ready Pool refill needs no distributed lock (design.md §3.1.1).
 */
@Injectable()
export class QueueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly qr: QrSignatureService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  // --- User-facing operations ---------------------------------------------

  /**
   * Take a ticket for a store after scanning its signed QR.
   * Idempotent: if this client already has an active ticket in the store,
   * the existing one is returned (design.md §2.1 / §2.8).
   */
  async takeTicket(
    storeId: string,
    sig: string | undefined,
    clientId: string,
  ): Promise<TicketView> {
    if (!this.qr.verify(storeId, sig)) {
      throw new ForbiddenException('Invalid store QR signature');
    }

    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const existing = await this.prisma.ticket.findFirst({
      where: { storeId, clientId, status: { in: ACTIVE_STATUSES } },
      orderBy: { number: 'desc' },
    });
    if (existing) {
      return this.toTicketView(existing);
    }

    const last = await this.prisma.ticket.findFirst({
      where: { storeId },
      orderBy: { number: 'desc' },
    });
    const nextNumber = (last?.number ?? 0) + 1;

    const ticket = await this.prisma.ticket.create({
      data: { storeId, clientId, number: nextNumber, status: TicketStatus.WAITING },
    });

    await this.reconcile(storeId);
    return this.toTicketView(ticket);
  }

  /** Current active ticket for a client (for return visits / reconnects). */
  async getMyTicket(storeId: string, clientId: string): Promise<TicketView | null> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { storeId, clientId, status: { in: ACTIVE_STATUSES } },
      orderBy: { number: 'desc' },
    });
    return ticket ? this.toTicketView(ticket) : null;
  }

  /** Latest ticket (any status) for a client across a store — used by SSE bootstrap. */
  async getLatestTicket(storeId: string, clientId: string): Promise<TicketView | null> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { storeId, clientId },
      orderBy: { createdAt: 'desc' },
    });
    return ticket ? this.toTicketView(ticket) : null;
  }

  /** User abandons their queue place. */
  async cancelMyTicket(storeId: string, clientId: string): Promise<void> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { storeId, clientId, status: { in: ACTIVE_STATUSES } },
      orderBy: { number: 'desc' },
    });
    if (!ticket) return;
    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: TicketStatus.CANCELLED },
    });
    await this.reconcile(storeId);
  }

  // --- Admin operations ----------------------------------------------------

  async getAdminQueue(storeId: string): Promise<AdminQueueView> {
    // Keep queue state fresh even during low-traffic periods (e.g., READY timeout).
    await this.reconcile(storeId, true);

    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');

    const tickets = await this.prisma.ticket.findMany({
      where: { storeId, status: { in: [...ACTIVE_STATUSES, TicketStatus.MISSED] } },
      orderBy: { number: 'asc' },
    });

    const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
    const sig = this.qr.sign(store.id);

    return {
      store: {
        id: store.id,
        name: store.name,
        timezone: store.timezone,
        staffCount: store.staffCount,
      },
      capacity: store.staffCount + READY_POOL_BUFFER,
      rules: {
        readyTimeoutMinutes: store.readyTimeoutMinutes,
        recallWindowMinutes: store.recallWindowMinutes,
        servingAlertMinutes: store.servingAlertMinutes,
      },
      scanUrl: `${webOrigin}/s/${store.id}?sig=${sig}`,
      tickets: await Promise.all(tickets.map((t) => this.toAdminTicketView(t))),
    };
  }

  /**
   * All tickets in a store (any status), newest number first.
   * Used by the admin ticket-lookup view to trace a customer's number
   * after it has left the live queue (DONE/MISSED/CANCELLED).
   */
  async getAllTickets(storeId: string): Promise<AdminTicketView[]> {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');

    const tickets = await this.prisma.ticket.findMany({
      where: { storeId },
      orderBy: { number: 'desc' },
    });
    return Promise.all(tickets.map((t) => this.toAdminTicketView(t)));
  }

  /** READY -> SERVING (staff starts serving). */
  async serve(ticketId: string): Promise<void> {
    const ticket = await this.requireTicket(ticketId);
    this.assertStatus(ticket, [TicketStatus.READY], 'serve');
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.SERVING, servedAt: new Date() },
    });
    await this.reconcile(ticket.storeId);
  }

  /** SERVING -> DONE (service complete, triggers refill). */
  async done(ticketId: string): Promise<void> {
    const ticket = await this.requireTicket(ticketId);
    this.assertStatus(ticket, [TicketStatus.SERVING], 'done');
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.DONE },
    });
    await this.reconcile(ticket.storeId);
  }

  /** READY -> MISSED (no response). Demoted, can be recalled (design.md §2.4). */
  async miss(ticketId: string): Promise<void> {
    const ticket = await this.requireTicket(ticketId);
    this.assertStatus(ticket, [TicketStatus.READY], 'miss');
    // Reset calledAt so the recall window counts from the miss moment.
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.MISSED, calledAt: new Date() },
    });
    await this.reconcile(ticket.storeId);
  }

  /** MISSED -> READY (staff one-click recall). */
  async recall(ticketId: string): Promise<void> {
    const ticket = await this.requireTicket(ticketId);
    this.assertStatus(ticket, [TicketStatus.MISSED], 'recall');

    const store = await this.prisma.store.findUnique({ where: { id: ticket.storeId } });
    if (!store) throw new NotFoundException('Store not found');

    const recallWindowMs = store.recallWindowMinutes * 60_000;
    const recalledFrom = ticket.calledAt ?? ticket.createdAt;
    if (Date.now() - recalledFrom.getTime() > recallWindowMs) {
      throw new BadRequestException('Recall window expired. Ask customer to take a new ticket.');
    }

    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.READY, calledAt: new Date() },
    });
    await this.reconcile(ticket.storeId);
  }

  /** Manually promote the next WAITING ticket into the Ready Pool. */
  async callNext(storeId: string): Promise<void> {
    const moved = await this.callNextBatch(storeId, 1);
    if (moved === 0) {
      throw new BadRequestException('No waiting tickets to call');
    }
  }

  /** Promote up to N WAITING tickets to READY in one action. */
  async callNextBatch(storeId: string, count: number): Promise<number> {
    this.assertPositiveInteger(count, 'count');

    const head = await this.prisma.ticket.findFirst({
      where: { storeId, status: TicketStatus.WAITING },
      orderBy: { number: 'asc' },
    });
    if (!head) return 0;

    const heads = await this.prisma.ticket.findMany({
      where: { storeId, status: TicketStatus.WAITING },
      orderBy: { number: 'asc' },
      take: count,
    });

    await this.prisma.ticket.updateMany({
      where: { id: { in: heads.map((t) => t.id) } },
      data: { status: TicketStatus.READY, calledAt: new Date() },
    });
    await this.publishStore(storeId);

    return heads.length;
  }

  /** Clear the queue (closing time). All active tickets -> CANCELLED. */
  async reset(storeId: string): Promise<void> {
    await this.prisma.ticket.updateMany({
      where: { storeId, status: { in: ACTIVE_STATUSES } },
      data: { status: TicketStatus.CANCELLED },
    });
    await this.publishStore(storeId);
  }

  /** Update in-shift staff count; capacity follows automatically (design.md §2.4). */
  async setStaffCount(storeId: string, staffCount: number): Promise<void> {
    if (!Number.isInteger(staffCount) || staffCount < 0) {
      throw new BadRequestException('staffCount must be a non-negative integer');
    }
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');
    await this.prisma.store.update({ where: { id: storeId }, data: { staffCount } });
    await this.reconcile(storeId);
  }

  /** Update store-level queue timing rules used by automation and alerts. */
  async setQueueRules(
    storeId: string,
    readyTimeoutMinutes: number,
    recallWindowMinutes: number,
    servingAlertMinutes: number,
  ): Promise<void> {
    this.assertPositiveInteger(readyTimeoutMinutes, 'readyTimeoutMinutes');
    this.assertPositiveInteger(recallWindowMinutes, 'recallWindowMinutes');
    this.assertPositiveInteger(servingAlertMinutes, 'servingAlertMinutes');

    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');

    await this.prisma.store.update({
      where: { id: storeId },
      data: {
        readyTimeoutMinutes,
        recallWindowMinutes,
        servingAlertMinutes,
      },
    });
    await this.reconcile(storeId);
  }

  // --- Ready Pool core -----------------------------------------------------

  /**
   * Keep the Ready Pool full: promote head WAITING tickets to READY until
   * READY count == capacity (staffCount + buffer). Never kicks out tickets
   * already READY when capacity shrinks (design.md §2.4).
   */
  private async reconcile(storeId: string, publishIfChangedOnly = false): Promise<void> {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) return;

    let changed = await this.expireReadyTickets(storeId, store.readyTimeoutMinutes);
    changed = (await this.expireMissedTickets(storeId, store.recallWindowMinutes)) || changed;

    const capacity = store.staffCount + READY_POOL_BUFFER;
    const readyCount = await this.prisma.ticket.count({
      where: { storeId, status: TicketStatus.READY },
    });

    const toPromote = capacity - readyCount;
    if (toPromote > 0) {
      const heads = await this.prisma.ticket.findMany({
        where: { storeId, status: TicketStatus.WAITING },
        orderBy: { number: 'asc' },
        take: toPromote,
      });
      for (const head of heads) {
        await this.prisma.ticket.update({
          where: { id: head.id },
          data: { status: TicketStatus.READY, calledAt: new Date() },
        });
      }
      changed = true;
    }

    if (!publishIfChangedOnly || changed) {
      await this.publishStore(storeId);
    }
  }

  /** Auto-demote READY tickets that stayed unanswered for too long. */
  private async expireReadyTickets(
    storeId: string,
    readyTimeoutMinutes: number,
  ): Promise<boolean> {
    const readyTimeoutMs = readyTimeoutMinutes * 60_000;
    const cutoff = new Date(Date.now() - readyTimeoutMs);

    const expired = await this.prisma.ticket.findMany({
      where: {
        storeId,
        status: TicketStatus.READY,
        calledAt: { not: null, lte: cutoff },
      },
      select: { id: true },
    });

    if (expired.length === 0) return false;

    // Reset calledAt so the recall window counts from the miss moment, not the
    // original READY-call time (otherwise it can expire to CANCELLED instantly).
    await this.prisma.ticket.updateMany({
      where: { id: { in: expired.map((t) => t.id) } },
      data: { status: TicketStatus.MISSED, calledAt: new Date() },
    });

    return true;
  }

  /** Auto-expire MISSED tickets once recall window has elapsed. */
  private async expireMissedTickets(
    storeId: string,
    recallWindowMinutes: number,
  ): Promise<boolean> {
    const recallWindowMs = recallWindowMinutes * 60_000;
    const cutoff = new Date(Date.now() - recallWindowMs);

    const expired = await this.prisma.ticket.findMany({
      where: {
        storeId,
        status: TicketStatus.MISSED,
        calledAt: { not: null, lte: cutoff },
      },
      select: { id: true },
    });

    if (expired.length === 0) return false;

    // Stamp calledAt so publishStore's recent-closure heuristic pushes a final client update.
    await this.prisma.ticket.updateMany({
      where: { id: { in: expired.map((t) => t.id) } },
      data: { status: TicketStatus.CANCELLED, calledAt: new Date() },
    });

    return true;
  }

  // --- View mapping + real-time push --------------------------------------

  private async peopleAhead(ticket: Ticket): Promise<number> {
    if (ticket.status !== TicketStatus.WAITING) return 0;
    return this.prisma.ticket.count({
      where: {
        storeId: ticket.storeId,
        status: TicketStatus.WAITING,
        number: { lt: ticket.number },
      },
    });
  }

  private async toTicketView(ticket: Ticket): Promise<TicketView> {
    return {
      id: ticket.id,
      storeId: ticket.storeId,
      number: ticket.number,
      status: ticket.status as TicketStatus,
      peopleAhead: await this.peopleAhead(ticket),
      createdAt: ticket.createdAt.toISOString(),
    };
  }

  private async toAdminTicketView(ticket: Ticket): Promise<AdminTicketView> {
    const base = await this.toTicketView(ticket);
    return {
      ...base,
      calledAt: ticket.calledAt ? ticket.calledAt.toISOString() : null,
      servedAt: ticket.servedAt ? ticket.servedAt.toISOString() : null,
    };
  }

  /**
   * Republish every relevant client's latest ticket in a store after a change.
   * Covers both active tickets (positions may have shifted) and clients whose
   * ticket just left the queue (DONE/MISSED/CANCELLED) so they get a final event.
   */
  private async publishStore(storeId: string): Promise<void> {
    // Active tickets — positions may have shifted.
    const active = await this.prisma.ticket.findMany({
      where: { storeId, status: { in: ACTIVE_STATUSES } },
      orderBy: { number: 'asc' },
    });
    for (const ticket of active) {
      const view = await this.toTicketView(ticket);
      this.publishClient(ticket.clientId, view);
    }

    // Tickets that just left the queue in the last moment — send final snapshot.
    const recentlyClosed = await this.prisma.ticket.findMany({
      where: {
        storeId,
        status: {
          in: [TicketStatus.DONE, TicketStatus.MISSED, TicketStatus.CANCELLED],
        },
        // Heuristic for PoC: only very recent closures, avoid replaying history.
        OR: [
          { servedAt: { gte: new Date(Date.now() - 5000) } },
          { calledAt: { gte: new Date(Date.now() - 5000) } },
        ],
      },
    });
    for (const ticket of recentlyClosed) {
      this.publishClient(ticket.clientId, await this.toTicketView(ticket));
    }
  }

  /** Push a client's latest ticket snapshot to their SSE stream. */
  private publishClient(clientId: string, ticket: TicketView | null): void {
    this.eventBus.publish(clientId, { ticket });
  }

  private async requireTicket(ticketId: string): Promise<Ticket> {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  private assertStatus(ticket: Ticket, allowed: TicketStatus[], action: string): void {
    if (!allowed.includes(ticket.status as TicketStatus)) {
      throw new BadRequestException(
        `Cannot ${action} a ticket in status ${ticket.status}`,
      );
    }
  }

  private assertPositiveInteger(value: number, field: string): void {
    if (!Number.isInteger(value) || value <= 0) {
      throw new BadRequestException(`${field} must be a positive integer`);
    }
  }
}
