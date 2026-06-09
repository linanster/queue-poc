import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { InfraModule } from './infra/infra.module';
import { CommonModule } from './common/common.module';
import { QueueModule } from './queue/queue.module';

@Module({
  imports: [PrismaModule, InfraModule, CommonModule, QueueModule],
})
export class AppModule {}
