import type { Core } from '@strapi/strapi';
import { verifiedAdminId } from '../../../club/admin-auth';
import { ADMIN_ERRORS } from '../../../club/athletes/errors';
import { refuseWith, type AdminCtx } from '../../../club/admin-http';
import { isFlowId } from '../../../club/onboarding/flows';
import { markFlow, markIntro, type Progress } from '../../../club/onboarding/progress';
import { changeProgress, readProgress } from '../../../club/onboarding/strapi-store';

type Mark = (p: Progress, at: string) => Progress;

function readMark(body: unknown): Mark | null {
  if (typeof body !== 'object' || body === null) return null;
  const { intro, flow } = body as { intro?: unknown; flow?: unknown };
  if (intro === true && flow === undefined) return markIntro;
  if (isFlowId(flow) && intro === undefined) return (p, at) => markFlow(p, flow, at);
  return null;
}

async function callerId(ctx: AdminCtx, strapi: Core.Strapi): Promise<number | null> {
  const id = await verifiedAdminId(ctx.request.header.authorization, strapi);
  return typeof id === 'number' ? id : null;
}

/** Admin API of the tour progress (routes/16-onboarding.ts); acts on the caller's own account only. */
export default {
  async read(ctx: AdminCtx) {
    const id = await callerId(ctx, strapi);
    if (id === null) return refuseWith(ctx, 401, ADMIN_ERRORS.invalid);
    ctx.body = { data: await readProgress(strapi, id) };
  },
  async mark(ctx: AdminCtx) {
    const mark = readMark(ctx.request.body);
    if (!mark) return refuseWith(ctx, 400, ADMIN_ERRORS.invalid);
    const id = await callerId(ctx, strapi);
    if (id === null) return refuseWith(ctx, 401, ADMIN_ERRORS.invalid);
    const at = new Date().toISOString();
    ctx.body = { data: await changeProgress(strapi, id, (p) => mark(p, at)) };
  },
};
