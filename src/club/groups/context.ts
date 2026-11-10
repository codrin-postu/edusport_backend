import type { Core } from '@strapi/strapi';
import { pingRevalidate } from '../../utils/revalidate';
import { attemptScheduleChangeJobs } from '../../email/strapi-email';
import { adminActor } from '../admin-actor';
import type { AdminCtx } from '../admin-http';
import { todayIso } from './http';
import { strapiGroupStore } from './strapi-store';
import type { GroupStore } from './types';

const SESSION = 'api::session.session' as const;

/** A saved session of an event, as the program writes need it (the presence rows are not read). */
export type EventSession = { id: string; date: string; startTime: string };
/** The sessions of the presence module, seen from the program: read by event, and moved to another event with a new occurrence key. */
export type SessionPort = {
  ofEvent: (eventId: string) => Promise<EventSession[]>;
  move: (sessionId: string, eventId: string, occurrenceKey: string) => Promise<void>;
};

/** Reads and writes join the open Strapi transaction (the same connection scope), so the checks of a program write see what the write sees. */
export const strapiSessionPort = (strapi: Core.Strapi): SessionPort => ({
  ofEvent: async (eventId) => {
    const rows = (await strapi.db.query(SESSION).findMany({ where: { event: { documentId: eventId } }, select: ['documentId', 'date', 'startTime'], limit: 100000 })) as Record<string, unknown>[];
    return rows.map((r) => ({ id: String(r.documentId), date: String(r.date), startTime: String(r.startTime ?? '').slice(0, 5) }));
  },
  move: async (sessionId, eventId, occurrenceKey) => {
    await strapi.documents(SESSION).update({ documentId: sessionId, data: { event: eventId, occurrenceKey } as never });
  },
});

/** What every phase 4 service gets from its controller. `today` is Bucharest's date, 'YYYY-MM-DD'. */
export type GroupContext = {
  store: GroupStore; actor: string; today: string; log: (message: string) => void; revalidate: () => void;
  /** After commit: the first attempt of a schedule change's e-mails once the hold is over. */
  emails: (changeKey: string) => void;
  now: () => Date;
  /** Saved sessions by event: a removed date or a deleted class must have none; a split moves the ones that stay with their class. */
  sessions: SessionPort;
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
    sessions: strapiSessionPort(strapi),
  };
}
