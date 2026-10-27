import { describe, expect, it } from 'vitest';
import { athleteListPage, readListQuery } from '../../athletes/list';
import type { ServiceContext } from '../../athletes/store';
import { ADMIN_ERRORS } from '../../athletes/errors';
import { athleteRow, fakeClubStore } from '../../athletes/__tests__/fake-store';
import { fakePresenceStore } from '../../presence/__tests__/fake-store';
import { NOW, OLD_SEASONS, TODAY, setup } from './list-review-setup';
import { hideInactiveReview, inactiveSummary, readInactiveSummary } from '../review';

const page = async (store: ReturnType<typeof setup>['store'], query: Record<string, string>) => athleteListPage(store, readListQuery(query), TODAY, NOW);
const names = (p: Awaited<ReturnType<typeof page>>) => p.data.map((r) => r.name);

describe('Sportivi list, 3C (spec 4, 5)', () => {
  it('hides anonymized athletes unless the status filter asks for them; counts leave them out', async () => {
    const { store } = setup();
    const all = await page(store, {});
    expect(names(all)).toEqual(['Activ Doi', 'Fără Nimic', 'Vechi Unu']);
    expect(all.unfiltered).toBe(3);
    const anonymized = await page(store, { status: 'anonimizat' });
    expect(names(anonymized)).toEqual(['Sportiv anonimizat']);
    expect(anonymized.data[0]).toMatchObject({ missing: [], dataIncomplete: false });
  });

  it('"Inactivi de peste N ani" lists only the inactive, with N from the settings', async () => {
    const { store } = setup();
    const inactive = await page(store, { inactive: 'true' });
    expect(names(inactive)).toEqual(['Fără Nimic', 'Vechi Unu']);
    expect(inactive.retentionYears).toBe(5);
    const six = await page(setup({ retentionYears: 6 }).store, { inactive: 'true' });
    expect(names(six)).toEqual(['Fără Nimic']);
    expect(six.retentionYears).toBe(6);
  });
});

describe('yearly review (spec 5)', () => {
  it('counts the inactive athletes and shows the notice', async () => {
    expect(await inactiveSummary(setup().store, fakePresenceStore().store, NOW)).toEqual({ retentionYears: 5, count: 2, seasonLabel: '2026-2027', shown: true });
  });

  it('"Ascunde până la sezonul următor" hides it for the current season only', async () => {
    const fake = setup({ retentionYears: 6 });
    const ctx: ServiceContext = { store: fake.store, actor: 'super@example.com', today: TODAY, log: () => undefined };
    expect(await hideInactiveReview(ctx, fakePresenceStore().store, NOW)).toEqual({ ok: true, data: { retentionYears: 6, count: 1, seasonLabel: '2026-2027', shown: false } });
    expect(fake.state.settings).toEqual({ retentionYears: 6, reviewHiddenUntilSeason: '2026-2027' });
  });

  it('without a current season there is nothing to hide', async () => {
    const fake = setup(null, OLD_SEASONS.map((s) => ({ ...s, isCurrent: false })));
    const ctx: ServiceContext = { store: fake.store, actor: 'super@example.com', today: TODAY, log: () => undefined };
    expect(await hideInactiveReview(ctx, fakePresenceStore().store, NOW)).toEqual({ ok: false, status: 409, error: ADMIN_ERRORS.stale });
  });

  it('the route read answers { data } like before', async () => {
    expect(await readInactiveSummary(setup().store, fakePresenceStore().store, () => undefined, NOW)).toEqual({ ok: true, data: { retentionYears: 5, count: 2, seasonLabel: '2026-2027', shown: true } });
  });

  it('a failure in either answers the shared copy, logged once each', async () => {
    const logs: string[] = [];
    const log = (message: string) => logs.push(message);
    const read = setup();
    read.failOn('seasons');
    expect(await readInactiveSummary(read.store, fakePresenceStore().store, log, NOW)).toEqual({ ok: false, status: 500, error: ADMIN_ERRORS.failed });
    const hide = setup();
    hide.failOn('seasons');
    const ctx: ServiceContext = { store: hide.store, actor: 'super@example.com', today: TODAY, log };
    expect(await hideInactiveReview(ctx, fakePresenceStore().store, NOW)).toEqual({ ok: false, status: 500, error: ADMIN_ERRORS.failed });
    expect(hide.state.settings).toBeNull();
    expect(logs).toEqual([
      '[personal-data] reading the yearly review failed: fake failure in seasons',
      '[personal-data] hiding the yearly review failed: fake failure in seasons',
    ]);
  });
});

describe('the inactivity view shows its own "inactiv" athletes, never anonymized ones (bug fix)', () => {
  function setupMarked() {
    return fakeClubStore({
      seasons: OLD_SEASONS,
      settings: null,
      athletes: [
        athleteRow({ id: 'marked', name: 'Marcat Inactiv', status: 'inactiv', createdAt: '2019-01-01T00:00:00.000Z' }),
        athleteRow({ id: 'markedAnon', name: 'Marcat Anonimizat', status: 'anonimizat', createdAt: '2019-01-01T00:00:00.000Z' }),
      ],
      memberships: [],
    });
  }

  it('an athlete with status inactiv and a last season 6+ years ago is listed only with the inactivity filter on', async () => {
    const { store } = setupMarked();
    const inactiveView = await page(store, { inactive: 'true' });
    expect(names(inactiveView)).toEqual(['Marcat Inactiv']);
    expect(inactiveView.unfiltered).toBe(1);
  });

  it('the same athlete is hidden in the default list', async () => {
    const { store } = setupMarked();
    const defaultView = await page(store, {});
    expect(names(defaultView)).toEqual([]);
    expect(defaultView.unfiltered).toBe(0);
  });

  it('an anonymized athlete never appears, even with the inactivity filter on', async () => {
    const { store } = setupMarked();
    const inactiveView = await page(store, { inactive: 'true' });
    expect(names(inactiveView)).not.toContain('Marcat Anonimizat');
  });
});
