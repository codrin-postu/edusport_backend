import type { SeasonRow } from '../../athletes/store';
import { SEASONS, athleteRow, fakeClubStore } from '../../athletes/__tests__/fake-store';

export const OLD_SEASONS: SeasonRow[] = [
  { id: 's21', label: '2021-2022', startMonth: '2021-10-01', endMonth: '2022-05-31', isCurrent: false },
  ...SEASONS,
];
export const NOW = new Date('2026-10-27T09:00:00.000Z');
export const TODAY = { year: 2026, month: 10, day: 27 };
const member = (id: string, athleteId: string, seasonId: string) => ({ id, athleteId, groupId: 'g-pp', seasonId, isMain: true, from: null });

export function setup(settings: unknown = null, seasons: SeasonRow[] = OLD_SEASONS) {
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
