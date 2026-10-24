import type { AdminResult } from './admin-result';

/** The part of Strapi's Koa context the club admin controllers use. */
export type AdminCtx = {
  params: Record<string, string | undefined>;
  query: Record<string, unknown>;
  request: { body?: unknown; header: { authorization?: string } };
  status: number;
  body: unknown;
};

/** 200 `{ data }`, or the refusal in Strapi's error shape, which the admin fetch client turns into the message. */
export function respond<T>(ctx: AdminCtx, result: AdminResult<T>): void {
  if (result.ok === true) {
    ctx.body = { data: result.data };
    return;
  }
  refuseWith(ctx, result.status, result.error);
}

export function refuseWith(ctx: AdminCtx, status: number, message: string): void {
  ctx.status = status;
  ctx.body = { data: null, error: { status, name: 'ClubAdminError', message } };
}

/** A path segment that must be a whole number (an item's place in its list). */
export function indexParam(raw: string | undefined): number | null {
  return raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : null;
}
