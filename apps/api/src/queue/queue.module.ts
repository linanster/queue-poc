import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { AdminController } from './admin.controller';
import { SseController } from './sse.controller';
import { StoreController } from './store.controller';

@Module({
  controllers: [QueueController, AdminController, SseController, StoreController],
  providers: [QueueService],
})
export class QueueModule {}
