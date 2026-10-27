import { describe, expect, it } from 'vitest';
import { athleteListPage, readListQuery } from '../../athletes/list';
import type { SeasonRow, ServiceContext } from '../../athletes/store';
import { ADMIN_ERRORS } from '../../athletes/errors';
import { SEASONS, athleteRow, fakeClubStore } from '../../athletes/__tests__/fake-store';
import { hideInactiveReview, inactiveSummary } from '../review';

const OLD_SEASONS: SeasonRow[] = [
  { id: 's21', label: '2021-2022', startMonth: '2021-10-01', endMonth: '2022-05-31', isCurrent: false },
  ...SEASONS,
];
const NOW = new Date('2026-10-27T09:00:00.000Z');
const TODAY = { year: 2026, month: 10, day: 27 };
const member = (id: string, athleteId: string, seasonId: string) => ({ id, athleteId, groupId: 'g-pp', seasonId, isMain: true, from: null });

function setup(settings: unknown = null, seasons: SeasonRow[] = OLD_SEASONS) {
  return fakeClubStore({
    seasons,
    settings,
    athletes: [
      athleteRow({ id: 'old', name: 'Vechi Unu', birthDate: '2012-01-01', contactName: 'P', phone: '07', email: 'p@x.ro' }),
      athleteRow({ id: 'cur', name: 'Activ Doi' }),
      athleteRow({ id: 'anon', name: 'Sportiv anonimizat', status: 'anonimizat' }),
      athleteRow({ id: 'none', name: 'Fără Nimic', createdAt: '2020-01-01T00:00:00.000Z' }),
    ],
    memberships: [member('m1', 'old', 's21'), member('m2', 'cur', 's26'), member('m3', 'anon', 's21')],
  });
}

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
    expect(await inactiveSummary(setup().store, NOW)).toEqual({ retentionYears: 5, count: 2, seasonLabel: '2026-2027', shown: true });
  });

  it('"Ascunde până la sezonul următor" hides it for the current season only', async () => {
    const fake = setup({ retentionYears: 6 });
    const ctx: ServiceContext = { store: fake.store, actor: 'super@example.com', today: TODAY, log: () => undefined };
    expect(await hideInactiveReview(ctx, NOW)).toEqual({ ok: true, data: { retentionYears: 6, count: 1, seasonLabel: '2026-2027', shown: false } });
    expect(fake.state.settings).toEqual({ retentionYears: 6, reviewHiddenUntilSeason: '2026-2027' });
  });

  it('without a current season there is nothing to hide', async () => {
    const fake = setup(null, OLD_SEASONS.map((s) => ({ ...s, isCurrent: false })));
    const ctx: ServiceContext = { store: fake.store, actor: 'super@example.com', today: TODAY, log: () => undefined };
    expect(await hideInactiveReview(ctx, NOW)).toEqual({ ok: false, status: 409, error: ADMIN_ERRORS.stale });
  });
});
