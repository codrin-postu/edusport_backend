import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { featureOfRoute, featureRoute, adminRoute, areaOfRoute } from '../../admin-area';
import { tableSubjectFeature } from '../../tables/features';
import type { Features } from '../features';

const ROUTES = join(__dirname, '../../../api/club/routes');

type Route = { method: string; path: string; handler: string; config: unknown };
async function routesOf(file: string): Promise<Route[]> {
  return ((await import(join(ROUTES, file))) as { default: { routes: Route[] } }).default.routes;
}

describe('which routes name a feature', () => {
  const whole: [string, string][] = [
    ['09-attendance.ts', 'prezenta'],
    ['10-subscriptions.ts', 'abonamente'],
    ['11-payments.ts', 'abonamente'],
    ['12-portal-accounts.ts', 'portalAntrenori'],
    ['14-athlete-access.ts', 'portalParinti'],
  ];
  it.each(whole)('every route of %s names %s', async (file, feature) => {
    const routes = await routesOf(file);
    expect(routes.length).toBeGreaterThan(0);
    for (const r of routes) expect(featureOfRoute(r.config), `${r.method} ${r.path}`).toBe(feature);
  });

  it('coach CSVs of attendance keep the money area and name prezenta', async () => {
    const csv = (await routesOf('09-attendance.ts')).filter((r) => r.path.endsWith('.csv'));
    expect(csv.length).toBe(2);
    for (const r of csv) {
      expect(areaOfRoute(r.config)).toBe('money');
      expect(featureOfRoute(r.config)).toBe('prezenta');
    }
  });

  it('only the four parcurs routes of 05-athletes.ts name parcurs, with the club area', async () => {
    const named = (await routesOf('05-athletes.ts')).filter((r) => featureOfRoute(r.config) !== null);
    expect(named.map((r) => r.handler).sort()).toEqual(['athletes.addAward', 'athletes.parcurs', 'athletes.removeAward', 'athletes.removePin']);
    for (const r of named) {
      expect(featureOfRoute(r.config)).toBe('parcurs');
      expect(areaOfRoute(r.config)).toBe('club');
    }
  });

  it('no other route file names a feature', async () => {
    const named = new Set(['05-athletes.ts', ...whole.map(([f]) => f)]);
    for (const file of readdirSync(ROUTES).filter((f) => f.endsWith('.ts') && !named.has(f))) {
      for (const r of await routesOf(file)) expect(featureOfRoute(r.config), `${file} ${r.path}`).toBeNull();
    }
  });

  it('featureRoute keeps the adminRoute shape and adds the feature', () => {
    const plain = adminRoute('club');
    const gated = featureRoute('parcurs', 'club');
    expect(gated).toEqual({ ...plain, policies: [{ name: 'global::has-role', config: { area: 'club', feature: 'parcurs' } }] });
    expect(areaOfRoute(gated)).toBe('club');
    expect(featureOfRoute(plain)).toBeNull();
  });
});

describe('table subjects and their features', () => {
  it('maps each subject', () => {
    expect(tableSubjectFeature('prezenta')).toBe('prezenta');
    expect(tableSubjectFeature('sedinte')).toBe('prezenta');
    expect(tableSubjectFeature('plati')).toBe('abonamente');
    expect(tableSubjectFeature('abonamente')).toBe('abonamente');
    expect(tableSubjectFeature('sportivi')).toBeNull();
  });
});

const ALL_ON: Features = { prezenta: true, abonamente: true, portalAntrenori: true, portalParinti: true, parcurs: true };
let current: Features = ALL_ON;
vi.mock('../strapi-store', () => ({ loadFeatures: async () => current }));
vi.mock('../../admin-auth', () => ({ requireAdminUser: async () => ({ id: 1, roles: [{ code: 'strapi-super-admin' }] }) }));
vi.mock('../../roles/map', () => ({
  roleCodesOf: () => ['x'],
  areasFor: () => ['club'],
  canUse: (_codes: string[], area: string) => area !== 'superAdmin',
}));

describe('global::has-role with a feature', () => {
  afterEach(() => { current = ALL_ON; });
  const strapi = { log: { warn: () => undefined } } as never;
  const run = async (config: object) => (await import('../../../policies/has-role')).default({ request: { header: { authorization: 'Bearer x' } }, state: {} }, config, { strapi });

  it('lets a feature that is on through', async () => {
    expect(await run({ area: 'club', feature: 'prezenta' })).toBe(true);
  });

  it('refuses a feature that is off with details.code featureOff', async () => {
    current = { ...ALL_ON, prezenta: false };
    await expect(run({ area: 'club', feature: 'prezenta' })).rejects.toMatchObject({ name: 'ForbiddenError', details: { code: 'featureOff', feature: 'prezenta' } });
  });

  it('checks the role first: a refused role is a plain ForbiddenError', async () => {
    current = { ...ALL_ON, prezenta: false };
    const error = await run({ area: 'superAdmin', feature: 'prezenta' }).catch((e: unknown) => e as { name: string; details?: unknown; message: string });
    expect((error as { name: string }).name).toBe('ForbiddenError');
    expect((error as { message: string }).message).toBe('Your role does not allow this');
    expect((error as { details?: { code?: string } }).details?.code).toBeUndefined();
  });

  it('a route without a feature never reads the switches', async () => {
    current = { prezenta: false, abonamente: false, portalAntrenori: false, portalParinti: false, parcurs: false };
    expect(await run({ area: 'club' })).toBe(true);
  });

  it('an unknown feature is a route bug', async () => {
    await expect(run({ area: 'club', feature: 'nope' })).rejects.toThrow(/unknown feature/);
  });
});
