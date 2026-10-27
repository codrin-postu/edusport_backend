import { describe, expect, it } from 'vitest';
import { athleteRow as clubAthlete } from '../../athletes/__tests__/fake-store';
import { listAthletes, readListQuery, athleteListPage, type ListPresence, type ListSource } from '../../athletes/list';
import { G_SEASONS, member } from '../../groups/__tests__/fake-group-store';
import { SECTIONS, GROUPS } from '../../athletes/__tests__/fake-store';
import { setup, NOW, TODAY } from '../../personal-data/__tests__/list-review-setup';
import { loadPresenceActivity } from '../lifecycle/activity';
import { abonamentCells } from '../subscriptions/cells';
import { abonamentCellText } from '../subscriptions/rules';
import { attendanceRow, fakePresenceContext, paymentRow, sessionRow, subscriptionRow } from './fake-store';

/** a1 5/8 until 2026-11-23 in g-ib; a2 expired; a3 none. */
const cellSeed = () => ({
  group: { memberships: [member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib' }), member({ id: 'm2', athleteId: 'a2', groupId: 'g-ib' })] },
  subscriptions: [
    subscriptionRow({ id: 'sa', athleteId: 'a1', validUntil: '2026-11-23' }),
    subscriptionRow({ id: 'sb', athleteId: 'a2', startsOn: '2026-09-01', validUntil: '2026-10-01' }),
  ],
  sessions: [1, 2, 3, 4, 5].map((n) => sessionRow({ id: `se${n}`, groupId: 'g-ib', date: `2026-11-0${n}` })),
  attendances: [1, 2, 3, 4, 5].map((n) => attendanceRow({ id: `t${n}`, sessionId: `se${n}`, uniqueKey: `se${n}|a1`, athleteId: 'a1', subscriptionId: 'sa', billing: 'slot' })),
});

const LIST_SOURCE: ListSource = {
  athletes: [clubAthlete({ id: 'a1', name: 'Ana Ionescu' }), clubAthlete({ id: 'a2', name: 'Bogdan Pop' })],
  registrations: [], memberships: [], acs: [], groups: GROUPS, sections: SECTIONS, profiles: [], duplicates: [],
  seasons: G_SEASONS.map((s) => ({ id: s.id, label: s.label, startMonth: s.startMonth, endMonth: s.endMonth, isCurrent: s.isCurrent })),
  season: null, today: { year: 2026, month: 11, day: 20 },
};

describe('Sportivi Abonament column', () => {
  it('one cell per athlete with an abonament 4.10 would use today (5.13, C65)', async () => {
    const f = fakePresenceContext(cellSeed());
    const cells = await abonamentCells(f.store, '2026-11-20');
    expect([...cells.keys()]).toEqual(['a1']);
    expect(abonamentCellText(cells.get('a1')!)).toBe('5/8, 23 noi 2026');
  });

  it('the list shows the column and filters Activ / Fără abonament (5.13)', () => {
    const cells = new Map([['a1', { subscriptionId: 'sa', itemName: 'Abonament 8 ședințe', slots: 8, used: 5, validUntil: '2026-11-23' }]]);
    const src = { ...LIST_SOURCE, abonamente: cells };
    expect(listAthletes(src, readListQuery({})).data.map((r) => [r.documentId, r.abonament])).toEqual([['a1', '5/8, 23 noi 2026'], ['a2', null]]);
    expect(listAthletes(src, readListQuery({ abonament: 'activ' })).data.map((r) => r.documentId)).toEqual(['a1']);
    expect(listAthletes(src, readListQuery({ abonament: 'fara' })).data.map((r) => r.documentId)).toEqual(['a2']);
    expect(readListQuery({ abonament: 'x' }).abonament).toBeNull();
  });

  it('"Inactivi de peste N ani" counts presence activity passed in (4.20, plan 5-4)', async () => {
    const { store } = setup();
    const ids = async (presence: ListPresence) => (await athleteListPage(store, readListQuery({ inactive: 'true' }), TODAY, NOW, presence)).data.map((r) => r.documentId);
    expect(await ids({})).toContain('old');
    const f = fakePresenceContext({ payments: [paymentRow({ id: 'p', athleteId: 'old', paidOn: '2026-10-27', seasonId: 's26' })] });
    expect(await ids({ activity: await loadPresenceActivity(f.store) })).not.toContain('old');
  });
});
