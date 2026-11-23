import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import cronTasks from '../../../../config/cron-tasks';
import portalAuth from '../../../api/portal/controllers/portal-auth';
import { attemptJob } from '../../../email/email-jobs';
import { fakeDeps, queuedJob } from '../../../email/__tests__/helpers';
import { portalCaller } from '../../../policies/portal-session';
import { inviteAccess, linkAccess } from '../access/invite';
import { inviteAccount, resendInvite } from '../accounts/invite';
import { harness, seedAccount } from '../accounts/__tests__/harness';
import { PORTAL_ERRORS } from '../copy';

const { notices, purge, housekeeping, lessonCancels } = vi.hoisted(() => ({ notices: vi.fn(), purge: vi.fn(), housekeeping: vi.fn(), lessonCancels: vi.fn() }));
vi.mock('../notices/strapi-sync', () => ({ syncClubWide: notices }));
vi.mock('../purge', () => ({ purgePortal: purge, purgeHousekeeping: housekeeping }));
vi.mock('../../presence/strapi-store', () => ({ strapiPresenceStore: () => ({ pruneLessonCancels: lessonCancels }) }));
vi.mock('../strapi-store', () => ({ strapiPortalStore: () => ({}) }));
vi.mock('../notices/strapi-store', () => ({ strapiNoticeStore: () => ({}) }));
vi.mock('../../security/strapi-store', () => ({ strapiSecurityStore: () => ({}) }));

const strapi = { log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } } as unknown as Core.Strapi;

beforeEach(() => {
  process.env.PORTAL_BFF_SECRET = 's'.repeat(40);
});
afterEach(() => {
  process.env.PORTAL_HOSTS = 'antrenor,sportiv';
  notices.mockReset();
  purge.mockReset();
  housekeeping.mockReset();
  lessonCancels.mockReset();
});

const off = (value?: string) => {
  if (value === undefined) delete process.env.PORTAL_HOSTS;
  else process.env.PORTAL_HOSTS = value;
};

describe.each([['unset', undefined], ['empty', ''], ['blank', ' , ']])('portals off (PORTAL_HOSTS %s)', (_label, value) => {
  beforeEach(() => off(value));

  it('portal auth routes answer 404, even with the right secret', async () => {
    (globalThis as { strapi?: unknown }).strapi = strapi;
    const ctx = { request: { headers: { 'x-portal-secret': 's'.repeat(40) }, body: {} }, status: 200, body: null as unknown };
    await portalAuth.login(ctx as never);
    expect(ctx.status).toBe(404);
    const ctx2 = { request: { headers: {}, body: {} }, status: 200, body: null as unknown };
    await portalAuth.refresh(ctx2 as never);
    expect(ctx2.status).toBe(404);
  });

  it('the portal session policy answers not found before the secret or session is read', async () => {
    const policy = { request: { header: { 'x-portal-secret': 's'.repeat(40) } }, state: {} };
    await expect(portalCaller(policy, strapi)).rejects.toBeInstanceOf(errors.NotFoundError);
  });

  it('the notice and purge crons return without touching anything', async () => {
    await cronTasks.portalNotices.task({ strapi });
    expect(notices).not.toHaveBeenCalled();
  });

  it('the purge cron skips the portal pruning but still runs the non-portal housekeeping', async () => {
    housekeeping.mockResolvedValue({ factors: 2, notices: 1 });
    lessonCancels.mockResolvedValue(3);
    await cronTasks.portalPurge.task({ strapi });
    expect(purge).not.toHaveBeenCalled();
    expect(housekeeping).toHaveBeenCalledTimes(1);
    expect(lessonCancels).toHaveBeenCalledTimes(1);
  });

  it('admin invites are refused with a clear message and queue nothing', async () => {
    const h = harness();
    const refused = { ok: false, status: 409, error: PORTAL_ERRORS.portalsOff };
    expect(await inviteAccount(h.c, 'tm1', { email: 'a@b.ro' })).toEqual(refused);
    const { id } = await seedAccount(h, 'invited');
    expect(await resendInvite(h.c, id)).toEqual(refused);
    expect(await linkAccess(h.c as never, 'at1', 'p@example.com')).toEqual(refused);
    expect(await inviteAccess(h.c as never, 'at1')).toMatchObject({ ok: false });
    expect(h.jobs).toHaveLength(0);
    expect(h.accessJobs).toHaveLength(0);
    expect(h.after).toEqual([]);
  });

  it('a queued invite or access mail stays queued, nothing is sent', async () => {
    const deps = fakeDeps();
    const job = queuedJob({ kind: 'portal-invite', payload: { name: 'A', link: 'https://x/invite/s', host: 'antrenor.x' } });
    expect(await attemptJob(deps, job)).toBe(job);
    expect(deps.sent).toHaveLength(0);
    const access = queuedJob({ kind: 'portal-access' });
    expect(await attemptJob(deps, access)).toBe(access);
    expect(deps.sent).toHaveLength(0);
  });
});

describe('portals on', () => {
  it('the purge cron runs the full purge', async () => {
    purge.mockResolvedValue({ limits: 0, devices: 0, tokens: 0, sessions: 0 });
    lessonCancels.mockResolvedValue(0);
    await cronTasks.portalPurge.task({ strapi });
    expect(purge).toHaveBeenCalledTimes(1);
    expect(housekeeping).not.toHaveBeenCalled();
  });

  it('the crons run', async () => {
    notices.mockResolvedValue({ created: 0, delivered: 0, ended: 0 });
    await cronTasks.portalNotices.task({ strapi });
    expect(notices).toHaveBeenCalledTimes(1);
  });

  it('an invite goes through and links to the configured portal host', async () => {
    const h = harness();
    const r = await inviteAccount(h.c, 'tm1', { email: 'a@b.ro' });
    expect(r.ok).toBe(true);
    expect(h.jobs[0].payload.link.startsWith('https://antrenor.scoaladepatinaj.com/invite/')).toBe(true);
  });

  it('an invite with no configured portal origin fails instead of deriving one', async () => {
    const saved = process.env.PORTAL_ANTRENOR_URL;
    delete process.env.PORTAL_ANTRENOR_URL;
    try {
      const h = harness();
      const r = await inviteAccount(h.c, 'tm1', { email: 'a@b.ro' });
      expect(r.ok).toBe(false);
      expect(h.jobs).toHaveLength(0);
    } finally {
      process.env.PORTAL_ANTRENOR_URL = saved;
    }
  });
});
