import { Global, Module } from '@nestjs/common';
import { EVENT_BUS } from './event-bus';
import { InMemoryEventBus } from './in-memory-event-bus';
import { RATE_LIMITER } from './rate-limiter';
import { InMemoryRateLimiter } from './in-memory-rate-limiter';

/**
 * Wires PoC in-memory implementations behind stable tokens.
 * Production swaps these providers for Redis-backed ones (design.md §3.1.1).
 */
@Global()
@Module({
  providers: [
    { provide: EVENT_BUS, useClass: InMemoryEventBus },
    { provide: RATE_LIMITER, useClass: InMemoryRateLimiter },
  ],
  exports: [EVENT_BUS, RATE_LIMITER],
})
export class InfraModule {}
