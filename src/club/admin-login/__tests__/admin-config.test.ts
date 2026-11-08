import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import adminConfig from '../../../../config/admin';
import serverConfig from '../../../../config/server';

const env = Object.assign((key: string) => `v:${key}`, { bool: (_k: string, d: boolean) => d });
const DAY = 24 * 3600;

describe('config/admin.ts session lifetimes (P6b q14 A)', () => {
  it('sets Strapi default numbers explicitly: remembered 14 d idle and 30 d max, otherwise 2 h idle and 1 d max', () => {
    const { sessions } = (adminConfig as (a: { env: typeof env }) => { auth: { sessions: Record<string, number> } })({ env }).auth;
    expect(sessions).toEqual({
      accessTokenLifespan: 30 * 60,
      idleRefreshTokenLifespan: 14 * DAY,
      maxRefreshTokenLifespan: 30 * DAY,
      idleSessionLifespan: 2 * 3600,
      maxSessionLifespan: DAY,
    });
  });

  it('remote data transfer is off, so /admin/transfer/tokens cannot mint tokens (the key Strapi reads: server.transfer.remote.enabled)', () => {
    const e = Object.assign((_k: string, d?: unknown) => d, { int: (_k: string, d: number) => d, array: () => ['k'] });
    const cfg = (serverConfig as (a: { env: typeof e }) => { transfer?: { remote?: { enabled?: boolean } } })({ env: e });
    expect(cfg.transfer?.remote?.enabled).toBe(false);
    const reader = readFileSync(join(__dirname, '../../../../node_modules/@strapi/admin/dist/server/server/src/middlewares/data-transfer.js'), 'utf8');
    expect(reader).toContain("server.transfer.remote.enabled");
  });

  it('the spec says so (4.2) instead of "not configured"', () => {
    const spec = readFileSync(join(__dirname, '../../../../docs/superpowers/specs/2026-11-07-admin-auth-roles-design.md'), 'utf8');
    expect(spec).not.toContain('`admin.auth.sessions` is not configured');
    expect(spec).toContain('`config/admin.ts` (`admin.auth.sessions`)');
  });
});
