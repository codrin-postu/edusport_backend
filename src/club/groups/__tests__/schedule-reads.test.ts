import { describe, expect, it } from 'vitest';
import type { CalendarEventRow } from '../../../api/calendar-event/services/expand';
import { adminWindow, publicWindow, readRange } from '../occurrences';
import { readGroupProgram } from '../program-read';
import { readPublicSchedule, scheduleSlots } from '../public-schedule';
import { G_GROUPS, G_SEASONS, event, fakeGroupStore } from './fake-group-store';

const TODAY = '2026-11-20';
const at = (startTime: string, endTime: string, days: ('sat' | 'sun' | 'tue')[] = ['sat', 'sun']) =>
  ({ freq: 'weekly' as const, days, weekOfMonth: null, startTime, endTime, singleDate: null, seasonStart: '2026-10-04', seasonEnd: '2027-05-31' });

describe('notebook slots (8.3, 9.1, W20)', () => {
  it('groups public, active school groups by start and end, in group order, once each', () => {
    const events = [
      event({ id: 'e1', groupId: 'g-is', recurrence: at('10:00', '10:50') }), event({ id: 'e2', groupId: 'g-pp', recurrence: at('10:00', '10:50') }),
      event({ id: 'e3', groupId: 'g-ib', recurrence: at('11:00', '11:50') }), event({ id: 'e4', groupId: 'g-ib', recurrence: { ...at('11:00', '11:50'), seasonEnd: '2026-11-01' } }),
    ];
    expect(scheduleSlots(G_GROUPS.filter((g) => g.sectionId === 'afi'), events, G_SEASONS[1], TODAY)).toEqual([
      { start: '10:00', end: '10:50', groups: ['Primii Pași', 'Intermediari Silver'] }, { start: '11:00', end: '11:50', groups: ['Intermediari Bronze'] },
    ]);
  });

  it('reads the current season; a non-public or inactive group is left out; Club never', async () => {
    const groups = G_GROUPS.map((g) => (g.id === 'g-is' ? { ...g, programPublic: false } : g));
    const store = fakeGroupStore({ groups, events: [event({ id: 'e1', groupId: 'g-is' }), event({ id: 'e2', groupId: 'g-pp' }), event({ id: 'e3', groupId: 'g-av', type: 'curs' })] }).store;
    expect(await readPublicSchedule(store, TODAY)).toEqual([
      { section: { name: 'Școala de Patinaj - AFI Cotroceni', slug: 'scoala-afi' }, slots: [{ start: '11:00', end: '11:50', groups: ['Primii Pași'] }] },
    ]);
  });

  it('leaves out an inactive group', async () => {
    const groups = G_GROUPS.map((g) => (g.id === 'g-pp' ? { ...g, active: false } : g));
    const store = fakeGroupStore({ groups, events: [event({ id: 'e2', groupId: 'g-pp' })] }).store;
    expect((await readPublicSchedule(store, TODAY))[0].slots).toEqual([]);
  });
});

describe('Program obișnuit rows (6.3)', () => {
  it('texts, from, and the next class date as the default of "Se aplică din"', async () => {
    const store = fakeGroupStore({ events: [event({ id: 'e1' })] }).store;
    const program = await readGroupProgram(store, 'g-ib', null, TODAY);
    expect(program?.series).toEqual([{
      eventId: 'e1', freq: 'weekly', days: ['sat', 'sun'], weekOfMonth: null, startTime: '11:00', durationMin: 50, from: '2026-10-04', to: '2027-05-31',
      text: 'Sâ și Du, 11:00, 50 min', fromText: '4 oct 2026', nextDate: '2026-11-21',
    }]);
  });
});

describe('occurrence windows (8.2, 8.3)', () => {
  const rows: CalendarEventRow[] = [
    { id: 1, documentId: 'e1', title: 'Intermediari Bronze', type: 'scoala', description: 'nota interna', recurrence: { freq: 'weekly', sat: true, startTime: '11:00:00.000', endTime: '11:50:00.000', seasonStart: '2026-10-03', seasonEnd: '2027-05-30' }, group: { documentId: 'g-ib', name: 'Intermediari Bronze', programPublic: false, active: true } },
    { id: 2, documentId: 'e2', title: 'Avansați', type: 'curs', description: 'nota interna', recurrence: { freq: 'weekly', sat: true, startTime: '18:00:00.000', endTime: '19:30:00.000', seasonStart: '2026-10-03', seasonEnd: '2027-05-30' }, group: { documentId: 'g-av', name: 'Avansați', programPublic: true, active: true } },
    { id: 3, documentId: 'e3', title: 'Inactivi', type: 'curs', recurrence: { freq: 'weekly', sat: true, startTime: '20:00:00.000', endTime: '21:00:00.000', seasonStart: '2026-10-03', seasonEnd: '2027-05-30' }, group: { documentId: 'g-x', name: 'Inactivi', programPublic: true, active: false } },
  ];
  const range = { from: '2026-11-14', to: '2026-11-14' };

  it('the public window drops a non-public or inactive group and never shows a group id', () => {
    const out = publicWindow({ events: rows, blackouts: [] }, range);
    expect(out.data.map((o) => o.groupName)).toEqual(['Avansați']);
    expect(Object.keys(out.data[0])).not.toContain('groupId');
  });

  it('the public window never carries a group event description; the admin window does', () => {
    expect(publicWindow({ events: rows, blackouts: [] }, range).data[0].description).toBeNull();
    expect(adminWindow({ events: rows, blackouts: [] }, range, 'g-av').data[0].description).toBe('nota interna');
  });

  it('the admin window keeps every group, or one group', () => {
    expect(adminWindow({ events: rows, blackouts: [] }, range, null).data.map((o) => o.groupId)).toEqual(['g-ib', 'g-av', 'g-x']);
    expect(adminWindow({ events: rows, blackouts: [] }, range, 'g-av').data.map((o) => o.groupId)).toEqual(['g-av']);
  });

  it('keeps the 92-day cap and the date format', () => {
    expect(readRange({ from: '2026-11-01', to: '2027-02-15' })).toEqual({ ok: false, error: 'range too large (max 92 days)' });
    expect(readRange({ from: 'x', to: '2026-11-30' }).ok).toBe(false);
    expect(readRange({ from: '2026-11-01', to: '2026-11-30' })).toEqual({ ok: true, value: { from: '2026-11-01', to: '2026-11-30' } });
  });
});
