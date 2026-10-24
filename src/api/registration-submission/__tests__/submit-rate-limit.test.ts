import type { Context, Next } from 'koa';
import { describe, expect, it } from 'vitest';
import { createRateLimiter } from '../../../utils/rate-limit';
import { RATE_LIMITED_BODY, SUBMIT_LIMIT, SUBMIT_WINDOW_MS, submitRateLimit } from '../middlewares/submit-rate-limit';
import publicRoutes from '../routes/01-public';

const MIN = 60_000;

function clock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe('createRateLimiter', () => {
  it('allows 5 hits per key in 10 minutes, then refuses, flagging only the first refusal', () => {
    const c = clock();
    const limiter = createRateLimiter(5, 10 * MIN, c.now);
    const decisions = Array.from({ length: 7 }, () => limiter.hit('1.2.3.4'));
    expect(decisions).toEqual(['allowed', 'allowed', 'allowed', 'allowed', 'allowed', 'blocked-first', 'blocked']);
    expect(limiter.hit('5.6.7.8')).toBe('allowed');
  });

  it('opens a new window once 10 minutes have passed', () => {
    const c = clock();
    const limiter = createRateLimiter(5, 10 * MIN, c.now);
    for (let i = 0; i < 6; i++) limiter.hit('1.2.3.4');
    c.advance(10 * MIN - 1);
    expect(limiter.hit('1.2.3.4')).toBe('blocked');
    c.advance(1);
    expect(limiter.hit('1.2.3.4')).toBe('allowed');
  });

  it('prunes keys whose window has ended', () => {
    const c = clock();
    const limiter = createRateLimiter(5, 10 * MIN, c.now);
    limiter.hit('a');
    limiter.hit('b');
    c.advance(10 * MIN);
    limiter.hit('c');
    expect(limiter.size()).toBe(1);
  });
});

function fakeCtx(ip: string) {
  return { ip, status: 404, body: undefined as unknown } as Context & { body: unknown };
}

async function post(handler: ReturnType<typeof submitRateLimit>, ip: string) {
  const ctx = fakeCtx(ip);
  let reached = false;
  const next: Next = async () => {
    reached = true;
  };
  await handler(ctx, next);
  return { ctx, reached };
}

describe('submitRateLimit', () => {
  it('passes 5 submits from one IP, answers the 6th with 429 and no error text, warns once', async () => {
    const warnings: string[] = [];
    const handler = submitRateLimit(createRateLimiter(SUBMIT_LIMIT, SUBMIT_WINDOW_MS), (m) => warnings.push(m));
    for (let i = 0; i < 5; i++) expect((await post(handler, '1.2.3.4')).reached).toBe(true);
    const sixth = await post(handler, '1.2.3.4');
    const seventh = await post(handler, '1.2.3.4');
    expect(sixth.reached).toBe(false);
    expect(sixth.ctx.status).toBe(429);
    expect(sixth.ctx.body).toEqual({ ok: false, code: 'rate-limited' });
    expect(seventh.ctx.body).toBe(RATE_LIMITED_BODY);
    expect(RATE_LIMITED_BODY).not.toHaveProperty('error');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('1.2.3.4');
    expect((await post(handler, '9.9.9.9')).reached).toBe(true);
  });

  it('is 5 per 10 minutes and sits in front of the public submit only', () => {
    expect(SUBMIT_LIMIT).toBe(5);
    expect(SUBMIT_WINDOW_MS).toBe(10 * MIN);
    expect(publicRoutes.routes).toEqual([
      expect.objectContaining({ path: '/forms/inscriere', config: expect.objectContaining({ middlewares: ['api::registration-submission.submit-rate-limit'] }) }),
    ]);
  });
});

describe('config/server', () => {
  it('trusts the X-Real-IP set by nginx, so ctx.ip is the visitor and not the proxy', async () => {
    const { default: server } = await import('../../../../config/server');
    const env = Object.assign((_key: string, fallback?: unknown) => fallback, { int: (_key: string, fallback?: number) => fallback, array: () => [] });
    expect(server({ env }).proxy).toEqual({ koa: true, ipHeader: 'X-Real-IP' });
  });
});
