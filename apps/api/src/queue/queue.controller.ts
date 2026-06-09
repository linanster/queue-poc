import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { CreateTicketRequest, TicketView } from '@queue/shared';
import { QueueService } from './queue.service';
import { CLIENT_COOKIE, CLIENT_COOKIE_MAX_AGE_MS } from '../common/client-cookie';
import { PrismaService } from '../prisma/prisma.service';
import { RATE_LIMITER, RateLimiter } from '../infra/rate-limiter';

/**
 * User-facing endpoints. Client identity is an anonymous id in an HttpOnly
 * cookie — no registration, no phone number (design.md §1.3 / §1.4 / §2.1).
 */
@Controller('api/tickets')
export class QueueController {
  constructor(
    private readonly queue: QueueService,
    private readonly prisma: PrismaService,
    @Inject(RATE_LIMITER) private readonly rateLimiter: RateLimiter,
  ) {}

  /** Take a ticket (scan → take). Idempotent per client+store. */
  @Post()
  async take(
    @Body() body: CreateTicketRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TicketView> {
    // Anti-abuse: throttle take attempts per IP+store (design.md §2.8).
    const ip = req.ip ?? 'unknown';
    if (!this.rateLimiter.allow(`take:${ip}:${body.storeId}`, 5, 10_000)) {
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    }
    const clientId = await this.ensureClient(req, res);
    return this.queue.takeTicket(body.storeId, body.sig, clientId);
  }

  /** Get current active ticket for this client (return visit / reconnect). */
  @Get('me')
  async me(
    @Query('storeId') storeId: string,
    @Req() req: Request,
  ): Promise<{ ticket: TicketView | null }> {
    const clientId = this.readClient(req);
    if (!clientId) return { ticket: null };
    return { ticket: await this.queue.getMyTicket(storeId, clientId) };
  }

  /** Abandon the queue. */
  @Delete('me')
  async cancel(
    @Query('storeId') storeId: string,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    const clientId = this.readClient(req);
    if (clientId) await this.queue.cancelMyTicket(storeId, clientId);
    return { ok: true };
  }

  // --- cookie-based anonymous identity ------------------------------------

  private readClient(req: Request): string | null {
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
    return cookies?.[CLIENT_COOKIE] ?? null;
  }

  private async ensureClient(req: Request, res: Response): Promise<string> {
    const existing = this.readClient(req);
    if (existing) {
      const found = await this.prisma.client.findUnique({ where: { id: existing } });
      if (found) return existing;
    }

    const client = await this.prisma.client.create({ data: { id: randomUUID() } });
    res.cookie(CLIENT_COOKIE, client.id, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: CLIENT_COOKIE_MAX_AGE_MS,
      path: '/',
    });
    return client.id;
  }
}
