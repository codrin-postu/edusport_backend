import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import portalFeature from '../../../policies/portal-feature';
import { portalCaller } from '../../../policies/portal-session';
import { portalWorld, SECRET, stores, withToken } from '../../../policies/__tests__/helpers';
import coachRoutes from '../../../api/portal/routes/02-coach';
import sportivRoutes from '../../../api/portal/routes/04-sportiv';
import { hostFeature, portalFeatures, type FeatureKey } from '../features';

vi.mock('../../portal/strapi-store', () => ({ strapiPortalStore: () => stores.portal }));
vi.mock('../../portal/access/strapi-store', () => ({ strapiAccessStore: () => stores.access }));

type Policy = string | { name: string; config?: { feature?: FeatureKey } };
type Route = { method: string; path: string; config: { policies: Policy[] } };

const featuresOf = (routes: Route[]): string[] =>
  routes.flatMap((r) => r.config.policies.flatMap((p) => (typeof p !== 'string' && p.name === 'global::portal-feature' ? [`${r.method} ${r.path} ${p.config?.feature}`] : []))).sort();

describe('which portal routes name a feature', () => {
  it('names exactly the coach routes of Prezență and Parcurs', () => {
    const base = '/portal/coach';
    const expected = [
      ['GET', '/session', 'prezenta'], ['POST', '/session/check', 'prezenta'], ['PUT', '/session', 'prezenta'],
      ['POST', '/lessons', 'prezenta'], ['PUT', '/lessons/:documentId/plan', 'prezenta'], ['GET', '/lessons/:documentId', 'prezenta'],
      ['PUT', '/lessons/:documentId', 'prezenta'], ['POST', '/lessons/:documentId/cancel', 'prezenta'], ['DELETE', '/lessons/:documentId', 'prezenta'],
      ['GET', '/athletes/:athleteId/parcurs', 'parcurs'], ['POST', '/athletes/:athleteId/awards', 'parcurs'], ['DELETE', '/athletes/:athleteId/awards/:awardId', 'parcurs'],
    ].map(([m, p, f]) => `${m} ${base}${p} ${f}`).sort();
    expect(featuresOf(coachRoutes.routes as Route[])).toEqual(expected);
  });

  it('names exactly the sportiv routes of Prezență, Abonamente and Parcurs', () => {
    const base = '/portal/sportiv/athletes/:athleteId';
    const expected = [
      ['GET', 'history', 'prezenta'], ['GET', 'money', 'abonamente'], ['GET', 'payments', 'abonamente'], ['GET', 'subscriptions', 'abonamente'],
      ['GET', 'path', 'parcurs'], ['GET', 'pin-recipients', 'parcurs'], ['POST', 'pins', 'parcurs'],
    ].map(([m, p, f]) => `${m} ${base}/${p} ${f}`).sort();
    expect(featuresOf(sportivRoutes.routes as Route[])).toEqual(expected);
  });

  it('keeps the session policy first on every gated route', () => {
    for (const r of [...(coachRoutes.routes as Route[]), ...(sportivRoutes.routes as Route[])]) {
      const names = r.config.policies.map((p) => (typeof p === 'string' ? p : p.name));
      expect(['global::is-coach', 'global::is-sportiv']).toContain(names[0]);
    }
  });
});

describe('global::portal-feature', () => {
  const strapi = {} as unknown as Core.Strapi;
  const run = (feature: FeatureKey, state: Record<string, unknown>) => portalFeature({ request: { header: {} }, state }, { feature }, { strapi });

  it('lets an active feature through and answers 404 for a disabled one', async () => {
    expect(await run('parcurs', { features: { parcurs: true } })).toBe(true);
    await expect(run('parcurs', { features: { parcurs: false } })).rejects.toBeInstanceOf(errors.NotFoundError);
  });

  it('reads the set itself when the session policy has not', async () => {
    (globalThis as { __features?: unknown }).__features = { prezenta: false };
    await expect(run('prezenta', {})).rejects.toBeInstanceOf(errors.NotFoundError);
    expect(await run('parcurs', {})).toBe(true);
  });
});

describe('hostFeature', () => {
  it.each([['antrenor', 'portalAntrenori'], ['sportiv', 'portalParinti'], ['admin', null], ['', null]])('%s -> %s', (host, expected) => {
    expect(hostFeature(host)).toBe(expected);
  });
});

describe('the me payload flags', () => {
  it('carries exactly prezenta, abonamente and parcurs', () => {
    const all = { prezenta: true, abonamente: false, portalAntrenori: true, portalParinti: true, parcurs: false };
    expect(portalFeatures(all)).toEqual({ prezenta: true, abonamente: false, parcurs: false });
  });
});

describe('portalCaller with a portal switched off', () => {
  const strapi = { log: { error: vi.fn() } } as unknown as Core.Strapi;
  afterEach(() => { (globalThis as { __features?: unknown }).__features = undefined; });
  const call = (token: string) => portalCaller({ request: { header: withToken(token) }, state: {} }, strapi);

  it('answers 404 for a valid sportiv session once portalParinti is off, and still serves the coach host', async () => {
    process.env.PORTAL_BFF_SECRET = SECRET;
    const w = await portalWorld();
    const parent = await w.login(3, 'sportiv');
    const coach = await w.login(1, 'antrenor');
    expect((await call(parent)).host).toBe('sportiv');
    (globalThis as { __features?: unknown }).__features = { portalParinti: false };
    await expect(call(parent)).rejects.toBeInstanceOf(errors.NotFoundError);
    expect((await call(coach)).features.portalAntrenori).toBe(true);
  });

  it('answers 404 for an antrenor session once portalAntrenori is off', async () => {
    process.env.PORTAL_BFF_SECRET = SECRET;
    const w = await portalWorld();
    const coach = await w.login(1, 'antrenor');
    (globalThis as { __features?: unknown }).__features = { portalAntrenori: false };
    await expect(call(coach)).rejects.toBeInstanceOf(errors.NotFoundError);
  });
});
