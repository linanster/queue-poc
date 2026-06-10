import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AdminQueueView } from '@queue/shared';
import { QueueService } from './queue.service';

/**
 * Operations backend (design.md §2.7).
 * PoC: no authentication — staff/manager auth is deferred to phase 2 (§3.6).
 */
@Controller('api/admin')
export class AdminController {
  constructor(private readonly queue: QueueService) {}

  @Get('stores/:storeId/queue')
  getQueue(@Param('storeId') storeId: string): Promise<AdminQueueView> {
    return this.queue.getAdminQueue(storeId);
  }

  @Post('stores/:storeId/call-next')
  async callNext(@Param('storeId') storeId: string): Promise<{ ok: true }> {
    await this.queue.callNext(storeId);
    return { ok: true };
  }

  @Post('stores/:storeId/call-next-batch')
  async callNextBatch(
    @Param('storeId') storeId: string,
    @Body('count') count: number,
  ): Promise<{ ok: true }> {
    await this.queue.callNextBatch(storeId, Number(count));
    return { ok: true };
  }

  @Post('stores/:storeId/reset')
  async reset(@Param('storeId') storeId: string): Promise<{ ok: true }> {
    await this.queue.reset(storeId);
    return { ok: true };
  }

  @Post('stores/:storeId/staff-count')
  async setStaffCount(
    @Param('storeId') storeId: string,
    @Body('staffCount') staffCount: number,
  ): Promise<{ ok: true }> {
    await this.queue.setStaffCount(storeId, Number(staffCount));
    return { ok: true };
  }

  @Post('stores/:storeId/rules')
  async setQueueRules(
    @Param('storeId') storeId: string,
    @Body('readyTimeoutMinutes') readyTimeoutMinutes: number,
    @Body('recallWindowMinutes') recallWindowMinutes: number,
    @Body('servingAlertMinutes') servingAlertMinutes: number,
  ): Promise<{ ok: true }> {
    await this.queue.setQueueRules(
      storeId,
      Number(readyTimeoutMinutes),
      Number(recallWindowMinutes),
      Number(servingAlertMinutes),
    );
    return { ok: true };
  }

  @Post('tickets/:ticketId/serve')
  async serve(@Param('ticketId') ticketId: string): Promise<{ ok: true }> {
    await this.queue.serve(ticketId);
    return { ok: true };
  }

  @Post('tickets/:ticketId/done')
  async done(@Param('ticketId') ticketId: string): Promise<{ ok: true }> {
    await this.queue.done(ticketId);
    return { ok: true };
  }

  @Post('tickets/:ticketId/miss')
  async miss(@Param('ticketId') ticketId: string): Promise<{ ok: true }> {
    await this.queue.miss(ticketId);
    return { ok: true };
  }

  @Post('tickets/:ticketId/recall')
  async recall(@Param('ticketId') ticketId: string): Promise<{ ok: true }> {
    await this.queue.recall(ticketId);
    return { ok: true };
  }
}
