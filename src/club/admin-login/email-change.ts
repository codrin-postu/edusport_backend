import type { Core } from '@strapi/strapi';
import { SECURITY_ACTIONS } from '../security/copy';
import type { SecurityStore } from '../security/store';
import { strapiSecurityStore } from '../security/strapi-store';
import { endAdminSessions } from './session';

const USER = 'admin::user' as const;
const SYSTEM_ACTOR = 'sistem';

/**
 * An admin's e-mail changed (a Super Admin in Settings, Users; spec 4.8): the Google link goes (it was proven for the old address), every
 * session ends and every remembered device is forgotten. The store is new for each call (its transaction pointer is per instance).
 */
export async function onAdminEmailChange(strapi: Core.Strapi, adminId: number, store: SecurityStore = strapiSecurityStore(strapi)): Promise<void> {
  const account = await store.adminAccount(adminId);
  if (account?.googleSub) {
    await store.updateAdminAccount(account.id, { googleSub: null });
    await store.record({ subjectType: 'admin', subjectId: String(adminId), action: SECURITY_ACTIONS.googleUnlinked, changes: {}, actor: SYSTEM_ACTOR });
  }
  await endAdminSessions({ strapi, store }, adminId, {});
}

type Event = { params?: { data?: Record<string, unknown>; where?: unknown }; state?: Record<string, unknown>; result?: Record<string, unknown> };
type Before = { id: number; email: string };

const same = (a: unknown, b: unknown): boolean => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

/** `beforeUpdate` remembers the e-mail the row has now; `afterUpdate` compares it with the saved one. */
export function emailChangeHandlers(strapi: Core.Strapi, onChange: (strapi: Core.Strapi, adminId: number) => Promise<void> = onAdminEmailChange) {
  return {
    beforeUpdate: async (event: Event): Promise<void> => {
      const data = event.params?.data;
      if (!data || typeof data.email !== 'string' || !event.params?.where || !event.state) return;
      const row = (await strapi.db.query(USER).findOne({ where: event.params.where as never, select: ['id', 'email'] })) as Before | null;
      if (row) event.state.emailBefore = { id: Number(row.id), email: row.email } satisfies Before;
    },
    afterUpdate: async (event: Event): Promise<void> => {
      const before = event.state?.emailBefore as Before | undefined;
      if (!before || !event.result || same(before.email, event.result.email)) return;
      try {
        await onChange(strapi, before.id);
      } catch (err) {
        strapi.log.error(`[admin-login] admin e-mail change cleanup failed: ${err instanceof Error ? err.name : 'error'}`);
        throw err;
      }
    },
  };
}

/** Bootstrap: a changed e-mail on `admin::user` ends the admin's sessions and clears the Google link. */
export function subscribeAdminEmailChange(strapi: Core.Strapi): void {
  strapi.db.lifecycles.subscribe({ models: [USER], ...emailChangeHandlers(strapi) });
}
