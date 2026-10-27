import type { Core } from '@strapi/strapi';
import { pingRevalidate } from '../../utils/revalidate';
import { adminActor } from '../admin-actor';
import type { AdminCtx } from '../admin-http';
import { isoDate, todayInBucharest } from '../birth-date';
import { strapiGroupStore } from './strapi-store';
import type { GroupStore } from './types';

/** What every phase 4 service gets from its controller. `today` is Bucharest's date, 'YYYY-MM-DD'. */
export type GroupContext = { store: GroupStore; actor: string; today: string; log: (message: string) => void; revalidate: () => void };

export async function groupContext(strapi: Core.Strapi, ctx: AdminCtx): Promise<GroupContext> {
  return {
    store: strapiGroupStore(strapi),
    actor: await adminActor(ctx.request.header.authorization, strapi),
    today: isoDate(todayInBucharest()),
    log: (message) => strapi.log.error(message),
    revalidate: () => {
      void pingRevalidate();
    },
  };
}
