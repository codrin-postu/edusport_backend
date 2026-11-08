import { afterEach } from 'vitest';
import { adminSessions } from '../../__tests__/admin-sessions';
import { setup } from '../../security/__tests__/security-helpers';
import type { AdminSessionManager, KoaContext } from '../session';

export type FakeAdmin = {
  id: number; email: string; firstname: string | null; lastname: string | null; isActive: boolean; blocked: boolean | null; password: string | null; roles: { code: string }[];
};
export type SetCookie = { name: string; value: string; options: Record<string, unknown> };

/**
 * The admin-login pieces over the memory security store: Strapi's real session manager over an in-memory `admin::session` table,
 * a fake Koa context (request cookies in `jar`, response cookies in `sets`, `sync()` is the browser storing them) and a fake `admin::user` table.
 */
export function adminEnv(o: Parameters<typeof setup>[0] = {}) {
  const env = setup(o);
  const sessions = adminSessions('admin-test-secret');
  const admins: FakeAdmin[] = [];
  const jar = new Map<string, string>();
  const sets: SetCookie[] = [];
  const koa: KoaContext & { request: { secure: boolean; ip: string; headers: Record<string, string> } } = {
    request: { secure: false, ip: '1.1.1.1', headers: { 'user-agent': 'Mozilla/5.0 (Macintosh) Chrome/120.0 Safari/537.36' } },
    cookies: {
      get: (name) => jar.get(name),
      set: (name, value, options = {}) => { sets.push({ name, value, options }); },
    },
  };
  const strapi = {
    sessionManager: sessions.manager,
    config: { get: (_key: string, fallback?: unknown) => fallback },
    log: { error: () => undefined, warn: () => undefined },
    db: {
      query: (uid: string) => ({
        findOne: async ({ where }: { where: { id?: number; email?: { $eqi: string } } }) => {
          if (uid !== 'admin::user') return null;
          const hit = where.id !== undefined ? admins.find((a) => a.id === where.id) : admins.find((a) => a.email.toLowerCase() === where.email?.$eqi.toLowerCase());
          return hit ? structuredClone(hit) : null;
        },
      }),
    },
  };
  const addAdmin = (a: Partial<FakeAdmin> & { id: number; email: string }): FakeAdmin => {
    const row: FakeAdmin = { firstname: null, lastname: null, isActive: true, blocked: false, password: null, roles: [], ...a };
    admins.push(row);
    return row;
  };
  const sync = (): void => {
    for (const s of sets.splice(0)) {
      if (s.value === '') jar.delete(s.name);
      else jar.set(s.name, s.value);
    }
  };
  const manager = sessions.manager as unknown as (origin: 'admin') => AdminSessionManager;
  const ctx = { strapi: strapi as never, koa, store: env.c.store, now: env.c.now };
  (globalThis as { strapi?: unknown }).strapi = strapi;
  return { ...env, sessions, admin: () => manager('admin'), admins, addAdmin, jar, sets, sync, koa, strapi, ctx };
}

/** Strapi's cookie helpers read the `strapi` global, which `adminEnv` sets; it is removed after each test. */
afterEach(() => {
  delete (globalThis as { strapi?: unknown }).strapi;
});


