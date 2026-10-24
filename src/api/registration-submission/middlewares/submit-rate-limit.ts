import type { Core } from '@strapi/strapi';
import { createRateLimiter, type RateLimiter } from '../../../utils/rate-limit';

export const SUBMIT_LIMIT = 5;
export const SUBMIT_WINDOW_MS = 10 * 60_000;
/** No `error` text on purpose: the website then shows its generic message (user, 2026-10-24). */
export const RATE_LIMITED_BODY = { ok: false, code: 'rate-limited' } as const;

/** In front of POST /api/forms/inscriere only: at most SUBMIT_LIMIT submits per IP per SUBMIT_WINDOW_MS. */
export function submitRateLimit(limiter: RateLimiter, warn: (message: string) => void): Core.MiddlewareHandler {
  return async (ctx, next) => {
    const decision = limiter.hit(ctx.ip);
    if (decision === 'allowed') return next();
    if (decision === 'blocked-first') warn(`[inscriere] rate limit: ${ctx.ip} sent more than ${SUBMIT_LIMIT} submits in 10 minutes`);
    ctx.status = 429;
    ctx.body = RATE_LIMITED_BODY;
  };
}

const factory: Core.MiddlewareFactory = (_config, { strapi }) =>
  submitRateLimit(createRateLimiter(SUBMIT_LIMIT, SUBMIT_WINDOW_MS), (message) => strapi.log.warn(message));

export default factory;
