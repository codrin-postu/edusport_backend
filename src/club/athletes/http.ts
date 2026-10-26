import type { Core } from '@strapi/strapi';
import { adminActor } from '../admin-actor';
import type { AdminCtx } from '../admin-http';
import { todayInBucharest } from '../birth-date';
import type { ClubStore, ServiceContext } from './store';
import { strapiClubStore } from './strapi-store';

/** What the club controllers pass to the services. */
export const clubStore = (strapi: Core.Strapi): ClubStore => strapiClubStore(strapi);

export async function serviceContext(strapi: Core.Strapi, ctx: AdminCtx): Promise<ServiceContext> {
  return {
    store: strapiClubStore(strapi),
    actor: await adminActor(ctx.request.header.authorization, strapi),
    today: todayInBucharest(),
    log: (message) => strapi.log.error(message),
  };
}

export const queryText = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
