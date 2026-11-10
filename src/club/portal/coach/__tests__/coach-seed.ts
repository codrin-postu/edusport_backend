import type { CalendarEventRow } from '../../../../api/calendar-event/services/expand';
import { fakeClubStore } from '../../../athletes/__tests__/fake-store';
import { athleteRow, event, member } from '../../../groups/__tests__/fake-group-store';
import type { DayKey, EventRecord, GroupStore, GroupRecord, NamedRow } from '../../../groups/types';
import { fakePresenceContext, subscriptionRow, type FakePresenceContext, type FakePresenceSeed } from '../../../presence/__tests__/fake-store';
import { fakePortalStore, type FakePortal } from '../../__tests__/fake-portal-store';
import { nullCoachCompetitions } from '../competitions';
import { coachActor, type CoachContexts } from '../context';

export const C_TEAM: NamedRow[] = [{ id: 'tm-andreea', name: 'Andreea Pascu' }, { id: 'tm-virgil', name: 'Virgil Pascu' }];

export const C_GROUPS: GroupRecord[] = [
  { id: 'g-club-a', name: 'Club A', sectionId: 'club', order: 1, active: true, priceListId: 'pl-club', coachIds: ['tm-andreea'], programPublic: true },
  { id: 'g-scoala-a', name: 'Școala A', sectionId: 'afi', order: 2, active: true, priceListId: 'pl-std', coachIds: ['tm-andreea'], programPublic: true },
  { id: 'g-club-b', name: 'Club B', sectionId: 'club', order: 3, active: true, priceListId: 'pl-club', coachIds: ['tm-virgil'], programPublic: true },
  { id: 'g-old', name: 'Veche', sectionId: 'afi', order: 4, active: false, priceListId: 'pl-std', coachIds: ['tm-andreea'], programPublic: true },
];

const personal = { contactName: 'Părinte Secret', phone: '0722000111', email: 'copil@example.com', notes: 'Alergie la polen' };
const C_ATHLETES = [
  athleteRow({ id: 'a-club-1', name: 'Ana Club', birthDate: '2012-03-14', ...personal }),
  athleteRow({ id: 'a-club-2', name: 'Bogdan Club', birthDate: '2010-05-02', ...personal }),
  athleteRow({ id: 'a-scoala-1', name: 'Carmen Școala', birthDate: '2016-09-20', ...personal }),
  athleteRow({ id: 'a-scoala-2', name: 'Dan Școala', birthDate: '2017-01-05', ...personal }),
  athleteRow({ id: 'a-b-1', name: 'Eva Cealaltă', birthDate: '2011-07-07', ...personal }),
  athleteRow({ id: 'a-free', name: 'Fără Grupă', birthDate: '2015-02-02', ...personal }),
];

const C_MEMBERSHIPS = [
  member({ id: 'gm-1', athleteId: 'a-club-1', groupId: 'g-club-a' }),
  member({ id: 'gm-2', athleteId: 'a-club-2', groupId: 'g-club-a' }),
  member({ id: 'gm-3', athleteId: 'a-scoala-1', groupId: 'g-scoala-a' }),
  member({ id: 'gm-4', athleteId: 'a-scoala-2', groupId: 'g-scoala-a' }),
  member({ id: 'gm-5', athleteId: 'a-b-1', groupId: 'g-club-b' }),
];

const weekly = (documentId: string, name: string, days: Record<string, boolean>, startTime: string, endTime: string, seasonStart: string): CalendarEventRow => ({
  id: documentId.length, documentId: `ev-${documentId}`, title: name, type: 'grupa',
  recurrence: { freq: 'weekly', ...days, startTime, endTime, endsNextDay: false, seasonStart, seasonEnd: '2027-05-31' },
  exceptions: [],
  group: { documentId, name, active: true, programPublic: true },
});

const C_CALENDAR: CalendarEventRow[] = [
  weekly('g-club-a', 'Club A', { fri: true }, '17:00', '18:30', '2026-10-02'),
  weekly('g-scoala-a', 'Școala A', { sat: true, sun: true }, '11:00', '11:50', '2026-10-04'),
  weekly('g-club-b', 'Club B', { wed: true, fri: true }, '18:00', '19:30', '2026-10-07'),
];

const series = (groupId: string, title: string, days: DayKey[], startTime: string, endTime: string): EventRecord => event({
  id: `ev-${groupId}`, title, groupId, type: groupId.startsWith('g-club') ? 'club' : 'scoala',
  recurrence: { freq: 'weekly', days, weekOfMonth: null, startTime, endTime, singleDate: null, seasonStart: '2026-10-02', seasonEnd: '2027-05-31' },
});

const C_EVENTS: EventRecord[] = [
  series('g-club-a', 'Club A', ['fri'], '17:00', '18:30'),
  series('g-scoala-a', 'Școala A', ['sat', 'sun'], '11:00', '11:50'),
  series('g-club-b', 'Club B', ['wed', 'fri'], '18:00', '19:30'),
];

const C_SEED: FakePresenceSeed = {
  group: { groups: C_GROUPS, teamMembers: C_TEAM, athletes: C_ATHLETES, memberships: C_MEMBERSHIPS, events: C_EVENTS },
  subscriptions: [
    subscriptionRow({ id: 'sub-s1', athleteId: 'a-scoala-1', priceListId: 'pl-std', price: 320, audience: 'member', slots: 8, startsOn: '2026-11-01', validUntil: '2026-11-28' }),
  ],
  calendar: { events: C_CALENDAR, blackouts: [] },
  startDate: '2026-10-01',
};

export type CoachSeed = CoachContexts & { fake: FakePresenceContext; portal: FakePortal['store']; portalFake: FakePortal; clubFake: ReturnType<typeof fakeClubStore> };

/** Contexts of one coach over the fakes: the phase 5 context carries the phase 4 and 5 state, the actor is "Antrenor <nume>". */
export function coachCtx(teamMemberId: string, today = '2026-11-20', over: FakePresenceSeed = {}): CoachSeed {
  const fake = fakePresenceContext({ ...C_SEED, ...over, group: { ...C_SEED.group, ...over.group } }, today);
  const name = C_TEAM.find((t) => t.id === teamMemberId)?.name ?? teamMemberId;
  const actor = coachActor(name);
  const portalFake = fakePortalStore({ teamMembers: Object.fromEntries(C_TEAM.map((t) => [t.id, t.name])) });
  const club = fakeClubStore({
    athletes: structuredClone(fake.group.athletes), memberships: structuredClone(fake.group.memberships),
    groups: fake.group.groups.map((g) => ({ id: g.id, name: g.name, sectionId: g.sectionId, order: g.order, active: g.active })),
  });
  const createAthlete = club.store.createAthlete;
  club.store.createAthlete = async (data) => {
    const id = await createAthlete(data);
    fake.group.athletes.push(athleteRow({ ...data, id }));
    return id;
  };
  const [year, month, day] = today.split('-').map(Number);
  return {
    coach: { accountId: 'acc-1', userId: 1, sessionId: 'ses-1', teamMemberId, name },
    today,
    presence: { ...fake.ctx, actor },
    groups: {
      store: fake.store as unknown as GroupStore, actor, today, log: fake.ctx.log, revalidate: () => undefined, emails: () => undefined, now: fake.ctx.now,
      sessions: {
        ofEvent: async (eventId) => fake.state.sessions.filter((s) => s.eventId === eventId).map((s) => ({ id: s.id, date: s.date, startTime: s.startTime })),
        move: (id, eventId, occurrenceKey) => fake.store.updateSession(id, { eventId, occurrenceKey }),
      },
    },
    club: { store: club.store, actor, today: { year, month, day }, log: fake.ctx.log },
    portal: portalFake.store, portalFake, fake, clubFake: club, competitions: nullCoachCompetitions,
  };
}
