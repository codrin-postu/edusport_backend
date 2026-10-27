import type { Core } from '@strapi/strapi';
import { adminActor } from '../admin-actor';
import type { AdminCtx } from '../admin-http';
import { todayIso } from '../groups/http';
import type { PresenceStore } from './store';
import { strapiPresenceStore } from './strapi-store';

/** What every phase 5 service gets from its controller. `today` is Bucharest's date, 'YYYY-MM-DD'. */
export type PresenceContext = { store: PresenceStore; actor: string; today: string; now: () => Date; log: (m: string) => void };

export async function presenceContext(strapi: Core.Strapi, ctx: AdminCtx): Promise<PresenceContext> {
  return {
    store: strapiPresenceStore(strapi),
    actor: await adminActor(ctx.request.header.authorization, strapi),
    today: todayIso(),
    now: () => new Date(),
    log: (message) => strapi.log.error(message),
  };
}
