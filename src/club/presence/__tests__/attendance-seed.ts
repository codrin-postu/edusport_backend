import type { MembershipRow } from '../../athletes/store';
import { athleteRow, member } from '../../groups/__tests__/fake-group-store';
import type { GroupRecord } from '../../groups/types';
import { phase5Lines } from '../history-lines';
import type { PriceItemRow } from '../types';
import type { CalendarEventRow } from '../../../api/calendar-event/services/expand';
import { fakePresenceContext, type FakePresenceContext, type FakePresenceSeed, subscriptionRow } from './fake-store';

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

/** Changes one item of a price list in the fixture. */
export function setPrice(f: FakePresenceContext, listId: string, itemName: string, values: Partial<Pick<PriceItemRow, 'memberPrice' | 'nonMemberPrice'>>): void {
  const item = f.state.priceLists.find((l) => l.id === listId)?.items.find((i) => i.name === itemName);
  if (!item) throw new Error(`fixture: no item ${itemName} in ${listId}`);
  Object.assign(item, values);
}

/** The Istoric texts of the lessons, in the order they were written. */
export function lessonLines(f: FakePresenceContext): string[] {
  const names = Object.fromEntries(f.group.teamMembers.map((t) => [t.id, t.name]));
  return [...f.group.history].filter((h) => h.subjectType === 'lesson').sort((a, b) => a.seq - b.seq)
    .flatMap((h) => phase5Lines(h.action, h.changes, h.subjectType, names) ?? []);
}
