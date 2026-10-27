import type { Core } from '@strapi/strapi';
import { pingRevalidate } from '../../utils/revalidate';
import { attemptScheduleChangeJobs } from '../../email/strapi-email';
import { adminActor } from '../admin-actor';
import type { AdminCtx } from '../admin-http';
import { todayIso } from './http';
import { strapiGroupStore } from './strapi-store';
import type { GroupStore } from './types';

/** What every phase 4 service gets from its controller. `today` is Bucharest's date, 'YYYY-MM-DD'. */
export type GroupContext = {
  store: GroupStore; actor: string; today: string; log: (message: string) => void; revalidate: () => void;
  /** After commit: the first attempt of a schedule change's e-mails once the hold is over. */
  emails: (changeKey: string) => void;
  now: () => Date;
};

export async function groupContext(strapi: Core.Strapi, ctx: AdminCtx): Promise<GroupContext> {
  return {
    store: strapiGroupStore(strapi),
    actor: await adminActor(ctx.request.header.authorization, strapi),
    today: todayIso(),
    log: (message) => strapi.log.error(message),
    revalidate: () => {
      void pingRevalidate();
    },
    emails: (changeKey) => attemptScheduleChangeJobs(strapi, changeKey),
    now: () => new Date(),
  };
}
