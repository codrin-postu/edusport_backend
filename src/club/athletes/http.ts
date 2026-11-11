import type { Core } from '@strapi/strapi';
import { adminActor } from '../admin-actor';
import type { AdminCtx } from '../admin-http';
import { todayInBucharest } from '../birth-date';
import { accessContext } from '../portal/access/context';
import type { ClubStore, ServiceContext } from './store';
import { strapiClubStore } from './strapi-store';

/** What the club controllers pass to the services. */
export const clubStore = (strapi: Core.Strapi): ClubStore => strapiClubStore(strapi);

export async function serviceContext(strapi: Core.Strapi, ctx: AdminCtx): Promise<ServiceContext> {
  const actor = await adminActor(ctx.request.header.authorization, strapi);
  return { store: strapiClubStore(strapi), actor, today: todayInBucharest(), log: (message) => strapi.log.error(message), access: accessContext(strapi, actor) };
}

export const queryText = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
