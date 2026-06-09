/** Name of the HttpOnly cookie that carries the anonymous client id. */
export const CLIENT_COOKIE = 'qid';

/** Cookie lifetime: long enough to survive a return visit (design.md §2.2). */
export const CLIENT_COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
