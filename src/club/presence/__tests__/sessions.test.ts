import { describe, expect, it } from 'vitest';
import type { CalendarEventRow } from '../../../api/calendar-event/services/expand';
import type { CalendarWindow } from '../../groups/occurrences';
import type { GroupRecord } from '../../groups/types';
import { attendanceKey, durationOf, heldOccurrences, isOutsideSchedule, occurrenceKey, readOccurrenceKey, sessionState } from '../sessions';

const EV_IB: CalendarEventRow = {
  id: 1, documentId: 'ev-ib', title: 'Intermediari Bronze', type: 'grupa',
  recurrence: { freq: 'weekly', sat: true, sun: true, startTime: '11:00', endTime: '11:50', endsNextDay: false, seasonStart: '2026-10-04' },
  exceptions: [
    { date: '2026-11-07', kind: 'cancel' },
    { date: '2026-11-08', kind: 'override', newDate: '2026-11-10', newStartTime: '17:00', newEndTime: '17:50' },
  ],
  group: { documentId: 'g-ib', name: 'Intermediari Bronze', active: true, programPublic: true },
};
const EV_OLD: CalendarEventRow = {
  id: 2, documentId: 'ev-old', title: 'Vechi', type: 'grupa',
  recurrence: { freq: 'weekly', sat: true, startTime: '09:00', endTime: '10:00', seasonStart: '2026-10-04' },
  exceptions: [],
  group: { documentId: 'g-old', name: 'Vechi', active: false, programPublic: true },
};
const EV_FREE: CalendarEventRow = {
  id: 3, documentId: 'ev-free', title: 'Fără grupă', type: 'grupa',
  recurrence: { freq: 'weekly', sun: true, startTime: '12:00', endTime: '13:00', seasonStart: '2026-10-04' },
  exceptions: [],
  group: null,
};
const calendar: CalendarWindow = { events: [EV_IB, EV_OLD, EV_FREE], blackouts: [] };
const P_GROUPS_WITH_OLD: GroupRecord[] = [
  { id: 'g-ib', name: 'Intermediari Bronze', sectionId: null, order: 1, active: true, priceListId: null, coachIds: [], programPublic: true },
  { id: 'g-old', name: 'Vechi', sectionId: null, order: 2, active: false, priceListId: null, coachIds: [], programPublic: true },
];

describe('session keys', () => {
  it('keys a session by the date and time the class takes place (C72)', () => {
    expect(occurrenceKey('ev-ib', '2026-11-10', '17:00')).toBe('ev-ib|2026-11-10|17:00');
    expect(readOccurrenceKey('ev-ib|2026-11-10|17:00')).toEqual({ eventId: 'ev-ib', date: '2026-11-10', startTime: '17:00' });
    expect([readOccurrenceKey('ev|2026-02-30|17:00'), readOccurrenceKey('ev|2026-11-10'), readOccurrenceKey(3)]).toEqual([null, null, null]);
    expect(attendanceKey('s1', 'a1')).toBe('s1|a1');
  });

  it('lists held occurrences of active groups only; a cancelled date is left out; a moved one is on its new date (3.9, 4.4, C14)', () => {
    expect(heldOccurrences(calendar, P_GROUPS_WITH_OLD, '2026-11-07', '2026-11-15').map((o) => o.key))
      .toEqual(['ev-ib|2026-11-10|17:00', 'ev-ib|2026-11-14|11:00', 'ev-ib|2026-11-15|11:00']);
    expect(heldOccurrences(calendar, P_GROUPS_WITH_OLD, '2026-11-14', '2026-11-14')[0]).toMatchObject({ groupId: 'g-ib', eventId: 'ev-ib', durationMin: 50, endTime: '11:50' });
  });

  it('state words: saved, coming, undone only from the start date (3.9, C13)', () => {
    const s = (saved: boolean, date: string, startDate: string | null) => sessionState({ saved, date, today: '2026-11-20', startDate });
    expect(s(true, '2026-11-01', null)).toBe('salvata');
    expect(s(false, '2026-11-20', '2026-11-01')).toBe('urmeaza');
    expect(s(false, '2026-11-19', '2026-11-01')).toBe('nefacuta');
    expect(s(false, '2026-10-31', '2026-11-01')).toBeNull();
    expect(s(false, '2026-11-19', null)).toBeNull();
  });

  it('a saved session whose date was cancelled or moved is outside the schedule (4.4, C19)', () => {
    const held = heldOccurrences(calendar, P_GROUPS_WITH_OLD, '2026-11-07', '2026-11-15');
    expect(isOutsideSchedule({ groupId: 'g-ib', date: '2026-11-07', startTime: '11:00' }, held)).toBe(true);
    expect(isOutsideSchedule({ groupId: 'g-ib', date: '2026-11-14', startTime: '11:00' }, held)).toBe(false);
  });

  it('duration from the occurrence, 50 without an end time', () => {
    expect(durationOf({ startTime: '17:00', endTime: '18:30', endsNextDay: false })).toBe(90);
    expect(durationOf({ startTime: '17:00', endTime: null, endsNextDay: false })).toBe(50);
    expect(durationOf({ startTime: '23:30', endTime: '00:20', endsNextDay: true })).toBe(50);
  });
});
