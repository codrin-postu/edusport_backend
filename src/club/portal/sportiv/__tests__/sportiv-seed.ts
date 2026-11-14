import { fakeNoticeStore } from '../../notices/__tests__/fake-store';
import type { NoticeSyncContext, PortalAnnouncement } from '../../notices/sync';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fakeClubStore } from '../../../athletes/__tests__/fake-store';
import { athleteRow, event, member } from '../../../groups/__tests__/fake-group-store';
import type { GroupRecord, GroupStore } from '../../../groups/types';
import { fakePresenceContext, subscriptionRow, P_GROUPS } from '../../../presence/__tests__/fake-store';
import { fakeAccessStore, type FakeAccess } from '../../access/fake-store';
import { fakePortalStore, type FakePortal } from '../../__tests__/fake-portal-store';
import type { CalendarEventRow } from '../../../../api/calendar-event/services/expand';
import { nullSportivCompetitions, nullSportivCompetitionViews } from '../competitions';
import type { CompetitionResults } from '../../../skate/pick';
import type { SportivContext } from '../context';
import type { HolderState } from '../holder';

export const A_ANA = 'a-ana';
export const A_MATEI = 'a-matei';
export const A_IOANA = 'a-ioana';
export const A_ELENA = 'a-elena';
export const A_RADU = 'a-radu';

const PERF: GroupRecord = { id: 'g-perf', name: 'Club Performanță', sectionId: 'club', order: 3, active: true, priceListId: 'pl-club', coachIds: ['tm-andreea'], programPublic: true };
export const S_GROUPS: GroupRecord[] = [...P_GROUPS, PERF];

const personal = { contactName: 'Părinte Secret', phone: '0722000111', notes: 'Alergie la polen' };
const S_ATHLETES = [
  athleteRow({ id: A_ANA, name: 'Ana Ionescu', birthDate: '2017-04-02', email: 'parinte1@example.invalid', ...personal }),
  athleteRow({ id: A_MATEI, name: 'Matei Ionescu', birthDate: '2019-06-11', email: 'parinte1@example.invalid', ...personal }),
  athleteRow({ id: A_IOANA, name: 'Ioana Marin', birthDate: '2007-01-20', email: 'sportiv18@example.invalid', profileId: 'sp-ioana', ...personal }),
  athleteRow({ id: A_ELENA, name: 'Elena Stan', birthDate: '2016-08-09', email: 'elena@example.invalid', status: 'nou', ...personal }),
  athleteRow({ id: A_RADU, name: 'Radu Pop', birthDate: '2014-03-03', email: 'antrenor1@example.invalid', ...personal }),
];

const weekly = (groupId: string, name: string, days: Record<string, boolean>, startTime: string, endTime: string): CalendarEventRow => ({
  id: groupId.length, documentId: `ev-${groupId}`, title: name, type: 'grupa',
  recurrence: { freq: 'weekly', ...days, startTime, endTime, endsNextDay: false, seasonStart: '2026-10-02', seasonEnd: '2027-05-31' },
  exceptions: [], group: { documentId: groupId, name, active: true, programPublic: true },
});
/** Intermediari Bronze meets on Saturday and Sunday at 11:00, Club Performanță on Tuesday and Thursday at 17:00. */
export const S_CALENDAR: CalendarEventRow[] = [
  weekly('g-ib', 'Intermediari Bronze', { sat: true, sun: true }, '11:00', '11:50'),
  weekly('g-perf', 'Club Performanță', { tue: true, thu: true }, '17:00', '18:30'),
];

/** Ana: an earlier main group (Primii Pași) until 14 November, Intermediari Bronze since 15 November. */
const S_MEMBERSHIPS = [
  member({ id: 'gm-ana-old', athleteId: A_ANA, groupId: 'g-pp', from: '2026-10-01', to: '2026-11-14' }),
  member({ id: 'gm-ana', athleteId: A_ANA, groupId: 'g-ib', from: '2026-11-15' }),
  member({ id: 'gm-matei', athleteId: A_MATEI, groupId: 'g-pp' }),
  member({ id: 'gm-ioana', athleteId: A_IOANA, groupId: 'g-perf' }),
  member({ id: 'gm-radu', athleteId: A_RADU, groupId: 'g-pro' }),
];

const holderOf = (athleteIds: string[]): HolderState => ({ accountId: 'acc-sp', userId: 1, sessionId: 'ses-1', athleteIds: [...athleteIds].sort() });

/** The e-mail of each fixture account and the athletes it holds. */
export const HOLDERS: Record<string, string[]> = {
  'parinte1@example.invalid': [A_ANA, A_MATEI],
  'sportiv18@example.invalid': [A_IOANA],
  'antrenor1@example.invalid': [A_RADU],
};

/** Results are unavailable until a test wires a source. */
const nullResults: CompetitionResults = { one: async () => ({ available: false }), many: async (refs) => new Map(refs.map((r) => [r.athleteId, { available: false } as const])) };

export type SportivSeed = SportivContext & { fake: ReturnType<typeof fakePresenceContext>; accessFake: FakeAccess; portalFake: FakePortal; clubFake: ReturnType<typeof fakeClubStore>;
  noticeFake: ReturnType<typeof fakeNoticeStore>; announcements: PortalAnnouncement[] };

/** Gives an athlete a profile without a skate-results slug (its competitions are the hand-entered ones). */
export function giveSluglessProfile(c: SportivSeed, athleteId: string, profileId: string): void {
  const athlete = c.clubFake.state.athletes.find((a) => a.id === athleteId);
  if (!athlete) throw new Error(`no athlete ${athleteId}`);
  athlete.profileId = profileId;
  c.clubFake.state.profiles.push({ id: profileId, name: athlete.name ?? '', slug: profileId, previousSlugs: [], showPublicPage: false, published: false, skateResultsSlug: '' });
}

/** Contexts of one holder over the fakes (index fixture, synthetic): Ioana has the skate slug `ioana-marin-test`, Elena has an e-mail and no access. */
export function sportivCtx(email: keyof typeof HOLDERS | string, today = '2026-11-20'): SportivSeed {
  const fake = fakePresenceContext({
    group: {
      groups: S_GROUPS, athletes: S_ATHLETES, memberships: S_MEMBERSHIPS,
      events: [event({ id: 'ev-ib', title: 'Intermediari Bronze', groupId: 'g-ib' })],
    },
    subscriptions: [subscriptionRow({ id: 'sub-ana', athleteId: A_ANA, priceListId: 'pl-std', price: 320, audience: 'member', slots: 8, startsOn: '2026-11-01', validUntil: '2026-11-28' })],
    startDate: '2026-10-01', calendar: { events: structuredClone(S_CALENDAR), blackouts: [] },
  }, today);
  const clubFake = fakeClubStore({
    athletes: structuredClone(fake.group.athletes), memberships: structuredClone(fake.group.memberships),
    groups: fake.group.groups.map((g) => ({ id: g.id, name: g.name, sectionId: g.sectionId, order: g.order, active: g.active })),
    profiles: [{ id: 'sp-ioana', name: 'Ioana Marin', slug: 'ioana-marin', previousSlugs: [], showPublicPage: false, published: true, skateResultsSlug: 'ioana-marin-test' }],
  });
  const accessFake = fakeAccessStore({
    rows: Object.entries(HOLDERS).flatMap(([mail, ids]) => ids.map((athleteId, i) => ({
      id: `acs-${mail}-${i}`, athleteId, accountId: `acc-${mail}`, email: mail, invitedAt: '2026-10-01T10:00:00.000Z', invitedBy: 'admin',
      revokedAt: null, revokedBy: null, revokeReason: null, levelSeenGroup: null, levelSeenAt: null,
    }))),
    athletes: S_ATHLETES.map((a) => ({ id: a.id, name: a.name ?? '', email: a.email, status: a.status, birthDate: a.birthDate, contactName: a.contactName })),
  });
  const portalFake = fakePortalStore({});
  const noticeFake = fakeNoticeStore();
  const announcements: PortalAnnouncement[] = [];
  const [year, month, day] = today.split('-').map(Number);
  const actor = 'Portal sportiv';
  const seed: SportivSeed = {
    holder: holderOf(HOLDERS[email] ?? []), today,
    presence: { ...fake.ctx, actor },
    groups: {
      store: fake.store as unknown as GroupStore, actor, today, log: fake.ctx.log, revalidate: () => undefined, emails: () => undefined, now: fake.ctx.now,
      sessions: { ofEvent: async () => [], move: async () => undefined },
    },
    club: { store: clubFake.store, actor, today: { year, month, day }, log: fake.ctx.log },
    portal: portalFake.store, access: accessFake.store, notices: noticeFake.store, noticeSync: () => noticeSync(seed), competitions: nullSportivCompetitions, competitionViews: nullSportivCompetitionViews, results: nullResults, documentsRoot: path.join(os.tmpdir(), `sportiv-docs-${randomBytes(6).toString('hex')}`), fake, accessFake, portalFake, clubFake, noticeFake, announcements,
  };
  return seed;
}

/** The notice sync over the seed's own stores (the fake notice store joins the portal fake's transaction). */
function noticeSync(seed: SportivSeed): NoticeSyncContext {
  return {
    notices: { ...seed.noticeFake.store, transaction: seed.portal.transaction }, portal: seed.portal, access: seed.access, sportiv: (holder) => ({ ...seed, holder }),
    announcements: async () => structuredClone(seed.announcements), now: seed.presence.now, today: seed.today, log: seed.presence.log,
  };
}
