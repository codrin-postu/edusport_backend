import type { Core } from '@strapi/strapi';
import { describe, expect, it } from 'vitest';
import databaseConfig from '../../../config/database';
import { attemptJob } from '../email-jobs';
import { cancelQueuedInvites } from '../strapi-email';
import { fakeDeps, queuedJob } from './helpers';

const payload = { name: 'Ana', link: 'https://antrenor.example.com/invite/SECRET', host: 'antrenor.example.com' };
const invite = (over = {}) => queuedJob({ kind: 'portal-invite', payload, ...over });

describe('invite link in the stored payload', () => {
  it('is blanked once the job is sent', async () => {
    const deps = fakeDeps();
    deps.stored.row = invite();
    const out = await attemptJob(deps, invite());
    expect(out.status).toBe('sent');
    expect(JSON.stringify(deps.stored.row.payload)).not.toContain('/invite/');
    expect((deps.stored.row.payload as { link: string }).link).toBe('');
  });
  it('is blanked when the job fails for good, kept while it is retried', async () => {
    const deps = fakeDeps();
    deps.send = async () => ({ ok: false, error: 'boom' });
    deps.stored.row = invite();
    await attemptJob(deps, invite());
    expect(deps.stored.row.status).toBe('queued');
    expect((deps.stored.row.payload as { link: string }).link).toContain('/invite/');
    deps.stored.row = invite({ attempts: 4 });
    await attemptJob(deps, invite({ attempts: 4 }));
    expect(deps.stored.row.status).toBe('failed');
    expect((deps.stored.row.payload as { link: string }).link).toBe('');
  });
  it('cancelQueuedInvites cancels the account queued invite jobs and blanks their links', async () => {
    const writes: { where: unknown; data: Record<string, unknown> }[] = [];
    const strapi = {
      db: { query: () => ({
        findMany: async (a: { where: unknown }) => { writes.push({ where: a.where, data: {} }); return [{ id: 7, payload }]; },
        update: async (a: { where: unknown; data: Record<string, unknown> }) => { writes.push(a); },
      }) },
    } as unknown as Core.Strapi;
    expect(await cancelQueuedInvites(strapi, 'acc1')).toBe(1);
    expect(writes[0].where).toEqual({ kind: 'portal-invite', changeKey: 'acc1', status: 'queued' });
    expect(writes[1].where).toEqual({ id: 7, status: 'queued' });
    expect(writes[1].data).toMatchObject({ status: 'cancelled', payload: { name: 'Ana', link: '' } });
  });
});

describe('database config', () => {
  it('keeps bound values out of database error messages', () => {
    const env = Object.assign((k: string, d?: unknown) => d, { int: (_k: string, d: number) => d, bool: (_k: string, d: boolean) => d });
    expect((databaseConfig({ env: env as never }).connection as Record<string, unknown>).compileSqlOnError).toBe(false);
  });
});
