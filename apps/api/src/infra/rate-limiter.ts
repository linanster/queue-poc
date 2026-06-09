/**
 * Abstraction over rate limiting (design.md §2.8 / §3.1.1).
 * PoC uses an in-memory fixed-window limiter; production swaps in Redis.
 */
export interface RateLimiter {
  /**
   * Returns true if the action for `key` is allowed, false if throttled.
   * @param key    bucket key, e.g. `${ip}:${storeId}`
   * @param limit  max actions per window
   * @param windowMs window size in milliseconds
   */
  allow(key: string, limit: number, windowMs: number): boolean;
}

export const RATE_LIMITER = Symbol('RATE_LIMITER');
