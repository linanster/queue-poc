import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { StoreView } from '@queue/shared';
import { PrismaService } from '../prisma/prisma.service';

/** Public store info for the user queue page header (design.md §1.7). */
@Controller('api/stores')
export class StoreController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':storeId')
  async getStore(@Param('storeId') storeId: string): Promise<StoreView> {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');
    return {
      id: store.id,
      name: store.name,
      timezone: store.timezone,
      staffCount: store.staffCount,
    };
  }
}
