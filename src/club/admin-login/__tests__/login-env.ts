import { vi } from 'vitest';
import type { SendPortalMail } from '../../../email/portal-direct';
import { seal, totpAad } from '../../security/secret-box';
import { adminLimits, cookieHelpers, type AdminLoginContext } from '../context';
import { endAdminSessions } from '../session';
import { adminEnv } from './admin-env';

export const COMMON = 'commonpassword1';

/** The admin login context over the memory stores (the pieces of `login.test.ts`, shared by the reset, invite, Google and Securitate tests). */
export function loginEnv(o: Parameters<typeof adminEnv>[0] = {}) {
  const env = adminEnv(o);
  const portalMails: { to: string; mail: Parameters<SendPortalMail>[1] }[] = [];
  const portalMail: SendPortalMail = async (to, mail) => {
    portalMails.push({ to, mail });
    return true;
  };
  const compare = vi.fn(async (p: string, h: string) => h === `hash:${p}`);
  const sleep = vi.fn(async () => undefined);
  const c: AdminLoginContext = {
    ...env.c, ...env.ctx, limits: adminLimits(env.c.limits), compare, secure: false, portalMail, common: new Set([COMMON]), sleep, ...cookieHelpers(env.koa, false),
    endSessions: (s, opts) => endAdminSessions(c, Number(s.id), opts),
  };
  const flush = () => new Promise((resolve) => setImmediate(resolve));
  const turnOnTotp = async (id = 7) => {
    const s = { type: 'admin' as const, id: String(id) };
    await c.store.confirmFactor(await c.store.upsertFactor(s, 'totp', { secretBox: seal(c.keys!, Buffer.from('12345678901234567890'), totpAad('admin', String(id))) }), c.now().toISOString());
  };
  return { ...env, c, compare, sleep, portalMails, flush, turnOnTotp };
}
export type LoginEnv = ReturnType<typeof loginEnv>;
