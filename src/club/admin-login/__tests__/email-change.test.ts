import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { captureMessage } from '../../../sentry';
import { SECURITY_ACTIONS } from '../../security/copy';
import { emailChangeHandlers, onAdminEmailChange } from '../email-change';
import { bindAdminDevice } from '../devices';
import { issueAdminSession } from '../session';
import { adminEnv } from './admin-env';

async function withSessions() {
  const env = adminEnv();
  const a = await bindAdminDevice({ store: env.c.store, now: env.c.now, userAgent: null }, 7, null);
  const b = await bindAdminDevice({ store: env.c.store, now: env.c.now, userAgent: null }, 7, null);
  await issueAdminSession(env.ctx, 7, a.device, true);
  await issueAdminSession(env.ctx, 7, b.device, false);
  await env.sessions.login(8);
  const until = '2026-12-01T00:00:00.000Z';
  for (const d of [a.device, b.device]) await env.c.store.updateAdminDevice(d.id, { twoFactorUntil: until });
  const account = await env.c.store.ensureAdminAccount(7);
  await env.c.store.updateAdminAccount(account.id, { googleSub: 'sub-1' });
  return { env, account };
}

describe('onAdminEmailChange', () => {
  it('clears googleSub, ends every session of that admin only, forgets every device 2FA, writes a history line', async () => {
    const { env, account } = await withSessions();
    await onAdminEmailChange(env.strapi as never, 7, env.c.store);
    expect((await env.c.store.adminAccount(7))?.googleSub).toBeNull();
    expect(env.sessions.rows.map((r) => r.userId)).toEqual(['8']);
    expect((await env.c.store.adminDevices(7)).every((d) => d.twoFactorUntil === null)).toBe(true);
    expect(env.mem.history).toEqual([expect.objectContaining({ subjectType: 'admin', subjectId: '7', action: SECURITY_ACTIONS.googleUnlinked, actor: 'sistem' })]);
    expect(account.googleSub).toBeNull();
  });

  it('an admin without an account row still has the sessions ended and no row is made', async () => {
    const env = adminEnv();
    await env.sessions.login(9);
    await onAdminEmailChange(env.strapi as never, 9, env.c.store);
    expect(env.sessions.rows).toHaveLength(0);
    expect(await env.c.store.adminAccount(9)).toBeNull();
  });
});

vi.mock('../../../sentry', () => ({ captureMessage: vi.fn() }));

describe('the admin::user lifecycle (B3 L3: the cleanup runs before the save)', () => {
  const strapiOf = (before: Record<string, unknown> | null, log = vi.fn()) => ({ db: { query: () => ({ findOne: async () => before }) }, log: { error: log } }) as never;
  const run = async (before: Record<string, unknown> | null, data: Record<string, unknown>) => {
    const onChange = vi.fn(async () => undefined);
    const h = emailChangeHandlers(strapiOf(before), onChange);
    await h.beforeUpdate({ params: { data, where: { id: 7 } } });
    return onChange;
  };

  it('has no afterUpdate: nothing runs once the new e-mail is written', () => {
    expect(Object.keys(emailChangeHandlers(strapiOf(null), vi.fn()))).toEqual(['beforeUpdate']);
  });

  it('an update that changes email calls onAdminEmailChange with the admin id, inside beforeUpdate', async () => {
    const onChange = await run({ id: 7, email: 'old@x.ro' }, { email: 'new@x.ro' });
    expect(onChange).toHaveBeenCalledWith(expect.anything(), 7);
  });

  it('an update without email, with the same email or only a case change does not', async () => {
    expect(await run({ id: 7, email: 'a@x.ro' }, { firstname: 'Ana' })).not.toHaveBeenCalled();
    expect(await run({ id: 7, email: 'a@x.ro' }, { email: 'a@x.ro' })).not.toHaveBeenCalled();
    expect(await run({ id: 7, email: 'a@x.ro' }, { email: 'A@x.ro' })).not.toHaveBeenCalled();
    expect(await run(null, { email: 'A@x.ro' })).not.toHaveBeenCalled();
  });

  it('a failing cleanup is logged, sent to Sentry and thrown from beforeUpdate, so the save does not happen', async () => {
    const log = vi.fn();
    const h = emailChangeHandlers(strapiOf({ id: 7, email: 'a@x.ro' }, log), async () => { throw new Error('boom'); });
    await expect(h.beforeUpdate({ params: { data: { email: 'b@x.ro' }, where: { id: 7 } } })).rejects.toThrow('boom');
    expect(log).toHaveBeenCalledWith(expect.stringContaining('admin e-mail change'));
    expect(vi.mocked(captureMessage)).toHaveBeenCalledWith(expect.stringContaining('admin e-mail change'));
  });

  it('bootstrap subscribes the handlers (B3 L2)', () => {
    expect(readFileSync(join(__dirname, '../../../index.ts'), 'utf8')).toMatch(/^\s*subscribeAdminEmailChange\(strapi\);/m);
  });
});
