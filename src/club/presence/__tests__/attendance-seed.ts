import type { AdminResult } from '../../admin-result';
import type { MembershipRow } from '../../athletes/store';
import { athleteRow, member } from '../../groups/__tests__/fake-group-store';
import type { GroupRecord } from '../../groups/types';
import type { CalendarEventRow } from '../../../api/calendar-event/services/expand';
import { attendanceRow, fakePresenceContext, type FakePresenceContext, type FakePresenceSeed, sessionRow, subscriptionRow } from './fake-store';

const ATTENDANCE_GROUPS: GroupRecord[] = [
  { id: 'g-ib', name: 'Intermediari Bronze', sectionId: 'afi', order: 2, active: true, priceListId: 'pl-std', coachIds: ['tm-virgil'], programPublic: true },
  { id: 'g-club', name: 'Profesioniști', sectionId: 'club', order: 5, active: true, priceListId: 'pl-club', coachIds: ['tm-andreea', 'tm-virgil'], programPublic: true },
  { id: 'g-nolist', name: 'Performanță', sectionId: 'club', order: 6, active: true, priceListId: null, coachIds: ['tm-andreea'], programPublic: true },
  { id: 'g-gold', name: 'Avansați Gold', sectionId: 'afi', order: 4, active: true, priceListId: 'pl-gold', coachIds: ['tm-virgil'], programPublic: true },
];

const ATTENDANCE_MEMBERSHIPS: MembershipRow[] = [
  member({ id: 'gm-a1', athleteId: 'a1', groupId: 'g-ib' }),
  member({ id: 'gm-a2', athleteId: 'a2', groupId: 'g-ib' }),
  member({ id: 'gm-a3', athleteId: 'a3', groupId: 'g-ib' }),
  member({ id: 'gm-a5', athleteId: 'a5', groupId: 'g-club' }),
  member({ id: 'gm-a6', athleteId: 'a6', groupId: 'g-club' }),
  member({ id: 'gm-a7', athleteId: 'a7', groupId: 'g-gold' }),
];

const ATTENDANCE_CALENDAR: CalendarEventRow[] = [
  {
    id: 1, documentId: 'ev-ib', title: 'Intermediari Bronze', type: 'grupa',
    recurrence: { freq: 'weekly', sat: true, sun: true, startTime: '11:00', endTime: '11:50', endsNextDay: false, seasonStart: '2026-10-04', seasonEnd: '2027-05-31' },
    exceptions: [],
    group: { documentId: 'g-ib', name: 'Intermediari Bronze', active: true, programPublic: true },
  },
  {
    id: 2, documentId: 'ev-club', title: 'Profesioniști', type: 'grupa',
    recurrence: { freq: 'weekly', fri: true, startTime: '17:00', endTime: '18:30', endsNextDay: false, seasonStart: '2026-10-02', seasonEnd: '2027-05-31' },
    exceptions: [],
    group: { documentId: 'g-club', name: 'Profesioniști', active: true, programPublic: true },
  },
];

const ATTENDANCE_BASE: FakePresenceSeed = {
  group: {
    groups: ATTENDANCE_GROUPS,
    athletes: [
      athleteRow({ id: 'a1', name: 'Ana Ionescu' }),
      athleteRow({ id: 'a2', name: 'Mihai Pop' }),
      athleteRow({ id: 'a3', name: 'Ioana Dinu', status: 'inactiv' }),
      athleteRow({ id: 'a5', name: 'David Stan' }),
      athleteRow({ id: 'a6', name: 'Luca Marin' }),
      athleteRow({ id: 'a7', name: 'Irina Neagu' }),
      athleteRow({ id: 'a9', name: 'Sportiv anonimizat', status: 'anonimizat' }),
    ],
    memberships: ATTENDANCE_MEMBERSHIPS,
    admins: { 'admin@example.com': 'Ana Admin' },
  },
  acs: [{ id: 'acs-a6', athleteId: 'a6', seasonId: 's26', state: 'da' }],
  subscriptions: [
    subscriptionRow({ id: 'sub-a1', athleteId: 'a1', priceListId: 'pl-std', itemName: 'Abonament 8 ședințe', slots: 8, price: 320, audience: 'member', startsOn: '2026-11-01', validUntil: '2026-11-28', purchasedAt: '2026-11-01T09:00:00.000Z' }),
    subscriptionRow({ id: 'sub-a7', athleteId: 'a7', priceListId: 'pl-gold', itemName: 'Abonament 8 ședințe Gold', slots: 8, price: 400, audience: 'member', startsOn: '2026-11-01', validUntil: '2026-11-28', purchasedAt: '2026-11-01T09:00:00.000Z' }),
  ],
  calendar: { events: ATTENDANCE_CALENDAR, blackouts: [] },
  startDate: '2026-11-01',
};

/** Shared attendance fixture (5-2): groups, athletes, memberships, subscriptions and calendar of the plan's seed. */
export function attendanceSeed(today = '2026-11-20', over: FakePresenceSeed = {}): FakePresenceContext {
  return fakePresenceContext({ ...ATTENDANCE_BASE, ...over, group: { ...ATTENDANCE_BASE.group, ...over.group } }, today);
}

/** The data of an AdminResult success. */
export function ok<T>(result: AdminResult<T>): T {
  if (result.ok === false) throw new Error(`expected ok, got ${result.status} ${result.error}`);
  return result.data;
}

/** Adds a saved Școala session s14 on 2026-11-14 at 11:00 (a1 present, a7 a visitor). */
export function withSaved14(f: FakePresenceContext): FakePresenceContext {
  f.state.sessions.push(sessionRow({
    id: 's14', groupId: 'g-ib', date: '2026-11-14', startTime: '11:00', durationMin: 50, source: 'schedule', eventId: 'ev-ib',
    occurrenceKey: 'ev-ib|2026-11-14|11:00', coachIds: ['tm-virgil'],
  }));
  f.state.attendances.push(attendanceRow({ id: 't14a', sessionId: 's14', athleteId: 'a1', uniqueKey: 's14|a1', grup: true, billing: 'slot', subscriptionId: 'sub-a1' }));
  f.state.attendances.push(attendanceRow({ id: 't14b', sessionId: 's14', athleteId: 'a7', uniqueKey: 's14|a7', grup: true, visitor: true, billing: 'fara_pret' }));
  return f;
}

/** Adds a saved Club session s13 on 2026-11-13 at 17:00: a5 on the list and ticked, a7 a visitor, saved by Ana Admin with its Istoric line. */
export function withSavedClub(f: FakePresenceContext): FakePresenceContext {
  f.state.sessions.push(sessionRow({
    id: 's13', groupId: 'g-club', date: '2026-11-13', startTime: '17:00', durationMin: 90, source: 'schedule', eventId: 'ev-club',
    occurrenceKey: 'ev-club|2026-11-13|17:00', coachIds: ['tm-andreea'], savedAt: '2026-11-13T16:05:00.000Z', firstSavedAt: '2026-11-13T16:05:00.000Z',
  }));
  f.state.attendances.push(attendanceRow({ id: 't13a', sessionId: 's13', athleteId: 'a5', uniqueKey: 's13|a5', grup: true, uscat: true }));
  f.state.attendances.push(attendanceRow({ id: 't13b', sessionId: 's13', athleteId: 'a7', uniqueKey: 's13|a7', grup: true, visitor: true }));
  f.group.history.push({
    id: 'h13', seq: 1, subjectType: 'session', subjectId: 's13', action: 'session-saved', changes: { present: 2, listed: 2, coachIds: ['tm-andreea'] },
    actor: 'admin@example.com', at: '2026-11-13T16:05:00.000Z',
  });
  return f;
}

/** Cancels one date of a schedule event (a cancel exception). */
export function cancelDate(f: FakePresenceContext, eventId: string, date: string): void {
  const event = f.state.calendar.events.find((e) => e.documentId === eventId);
  if (!event) throw new Error(`fixture: no event ${eventId}`);
  event.exceptions = [...(event.exceptions ?? []), { date, kind: 'cancel' }];
}
