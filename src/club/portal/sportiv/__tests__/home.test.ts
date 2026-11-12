import { describe, expect, it } from 'vitest';
import type { CalendarEventRow } from '../../../../api/calendar-event/services/expand';
import { forbiddenPathsIn } from '../../forbidden-keys';
import { readCard } from '../../coach/athletes';
import { attendanceRow, lessonRow, sessionRow } from '../../../presence/__tests__/fake-store';
import { markPromotionSeen, readHome } from '../home';
import { SPORTIV_ALLOWED_PATHS, SPORTIV_FORBIDDEN_KEYS } from '../views';
import { A_ANA, A_IOANA, A_MATEI, sportivCtx, type SportivSeed } from './sportiv-seed';
import { nullCoachCompetitions, type CoachContexts } from '../../coach/context';

/** The coach of Intermediari Bronze reading over the same fakes, for the numbers both apps must agree on. */
const fakeCoachCtx = (c: SportivSeed): CoachContexts => ({
  coach: { accountId: 'acc-c', userId: 2, sessionId: 'ses-c', teamMemberId: 'tm-virgil', name: 'Virgil Pascu' },
  today: c.today, presence: c.presence, groups: c.groups, club: c.club, portal: c.portal, competitions: nullCoachCompetitions,
});

/** Ana with 24 group presences (two of them uscat) and 2 present lessons in the season: 26 in all. */
function withPresences(c: SportivSeed): void {
  for (let i = 0; i < 24; i++) {
    const date = i < 12 ? `2026-10-${String(i + 2).padStart(2, '0')}` : `2026-11-${String(i - 11).padStart(2, '0')}`;
    const id = `s-${i}`;
    c.fake.state.sessions.push(sessionRow({ id, groupId: 'g-pp', date }));
    c.fake.state.attendances.push(attendanceRow({ id: `t-${i}`, sessionId: id, athleteId: A_ANA, uniqueKey: `${id}|ana`, grup: i >= 2, uscat: i < 2 }));
  }
  c.fake.state.lessons.push(lessonRow({ id: 'l-1', athleteId: A_ANA, date: '2026-10-20', state: 'saved', present: true }));
  c.fake.state.lessons.push(lessonRow({ id: 'l-2', athleteId: A_ANA, date: '2026-11-05', state: 'saved', present: true }));
  c.fake.state.lessons.push(lessonRow({ id: 'l-3', athleteId: A_ANA, date: '2026-11-06', state: 'saved', present: false }));
}

describe('readHome', () => {
  it('the level is the main group today with the section location', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    c.fake.group.sections.find((s) => s.id === 'afi')!.locationName = 'AFI Cotroceni';
    const home = await readHome(c, A_ANA);
    expect(home.athlete).toEqual({ id: A_ANA, name: 'Ana Ionescu', firstName: 'Ana', age: 9, inactive: false });
    expect(home.level).toEqual({ groupId: 'g-ib', groupName: 'Intermediari Bronze', sectionName: 'Școala de Patinaj - AFI Cotroceni', section: 'school', location: 'AFI Cotroceni' });
    expect(home.seasonLabel).toBe('2026-2027');
    expect(home.lastCompetition).toBeNull();
  });

  it('a dated move in the future does not change today level', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    const current = c.fake.group.memberships.find((m) => m.id === 'gm-ana')!;
    current.to = '2026-12-04';
    c.fake.group.memberships.push({ ...current, id: 'gm-ana-next', groupId: 'g-pp', from: '2026-12-05', to: null });
    expect((await readHome(c, A_ANA)).level?.groupName).toBe('Intermediari Bronze');
  });

  it('counts the presences of the season: group rows (uscat too) and present lessons', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    withPresences(c);
    const home = await readHome(c, A_ANA);
    expect(home.presences.total).toBe(26);
    expect(home.presences.months).toEqual([
      { month: '2026-10', count: 13, state: 'past' }, { month: '2026-11', count: 13, state: 'current' },
      { month: '2026-12', count: null, state: 'future' }, { month: '2027-01', count: null, state: 'future' },
      { month: '2027-02', count: null, state: 'future' }, { month: '2027-03', count: null, state: 'future' },
    ]);
  });

  it('the presence total is the same number the coach card shows', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    withPresences(c);
    const coach = fakeCoachCtx(c);
    const card = await readCard(coach, A_ANA);
    expect(card.ok && card.data.presence.season).toBe((await readHome(c, A_ANA)).presences.total);
  });

  it('upcoming: the next 3 own items from now, a cancelled date skipped', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    c.fake.state.calendar.events[0].exceptions = [{ date: '2026-11-21', kind: 'cancel' }];
    c.fake.state.lessons.push(lessonRow({ id: 'l-p', athleteId: A_ANA, date: '2026-11-23', startTime: '17:00', coachIds: ['tm-andreea'] }));
    c.fake.state.lessons.push(lessonRow({ id: 'l-m', athleteId: A_MATEI, date: '2026-11-22', startTime: '09:00' }));
    const { upcoming } = await readHome(c, A_ANA);
    expect(upcoming.map((i) => [i.date, i.startTime, i.kind, i.title, i.cancelled])).toEqual([
      ['2026-11-22', '11:00', 'grupa', 'Intermediari Bronze', false], ['2026-11-23', '17:00', 'individual', 'lecție individuală', false], ['2026-11-28', '11:00', 'grupa', 'Intermediari Bronze', false],
    ]);
    expect(upcoming[0]).toMatchObject({ endTime: '11:50', coaches: ['Virgil Pascu'] });
    expect(upcoming[1]).toMatchObject({ coaches: ['Andreea Pascu'] });
  });

  it('an item earlier today is not upcoming', async () => {
    const c = sportivCtx('parinte1@example.invalid', '2026-11-21'); // Saturday, now is 12:00 in Bucharest
    c.fake.state.lessons.push(lessonRow({ id: 'l-e', athleteId: A_ANA, date: '2026-11-21', startTime: '08:00' }));
    c.fake.state.calendar.events[0].recurrence.startTime = '11:00';
    const { upcoming } = await readHome(c, A_ANA);
    expect(upcoming[0].date).toBe('2026-11-22');
  });

  it('an all-day item today (no start time) stays upcoming', async () => {
    const c = sportivCtx('parinte1@example.invalid', '2026-11-21');
    c.fake.state.calendar.events.push({
      id: 88, documentId: 'ev-concurs', title: 'Concurs Brașov', type: 'concurs',
      recurrence: { freq: 'none', singleDate: '2026-11-21', endsNextDay: false, seasonStart: '2026-10-02', seasonEnd: '2027-05-31' } as CalendarEventRow['recurrence'],
      exceptions: [], group: { documentId: 'g-ib', name: 'Intermediari Bronze', active: true, programPublic: true },
    });
    const { upcoming } = await readHome(c, A_ANA);
    expect(upcoming.some((i) => i.kind === 'concurs' && i.date === '2026-11-21' && i.startTime === null)).toBe(true);
  });

  it('abonament: 5 when 4 of 8 are used, 8 when 8 of 8 are used, the code when there is one', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    c.fake.state.sessions.push(...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => sessionRow({ id: `u-${i}`, groupId: 'g-ib', date: `2026-11-${String(i + 2).padStart(2, '0')}` })));
    const use = (n: number): void => {
      c.fake.state.attendances.length = 0;
      for (let i = 0; i < n; i++) c.fake.state.attendances.push(attendanceRow({ id: `ua-${i}`, sessionId: `u-${i}`, athleteId: A_ANA, uniqueKey: `u-${i}|ana`, subscriptionId: 'sub-ana', billing: 'slot' }));
    };
    use(4);
    expect((await readHome(c, A_ANA)).abonament).toEqual({ code: null, next: 5, slots: 8, validUntil: '2026-11-28' });
    const coach = await readCard(fakeCoachCtx(c), A_ANA);
    expect(coach.ok && coach.data.abonament?.next).toBe(5);
    c.fake.state.subscriptions[0].code = 'AB-12';
    expect((await readHome(c, A_ANA)).abonament?.code).toBe('AB-12');
    use(8);
    expect((await readHome(c, A_ANA)).abonament).toMatchObject({ next: 8, slots: 8 });
  });

  it('no abonament for a child without one or a cancelled one', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    expect((await readHome(c, A_MATEI)).abonament).toBeNull();
    c.fake.state.subscriptions[0].cancelled = true;
    expect((await readHome(c, A_ANA)).abonament).toBeNull();
  });

  it('a performance athlete: the last competition is unavailable with the null source, and the source answer fills it with its category', async () => {
    const c = sportivCtx('sportiv18@example.invalid');
    expect((await readHome(c, A_IOANA)).lastCompetition).toEqual({ available: false });
    const row = { resultId: 'r1', eventName: 'Cupa Test', date: '2026-11-01', location: 'Bucuresti', category: 'Advanced Novice Girls', categoryShort: 'Adv. Novice', placement: 2, total: 98.42 };
    c.competitions = { last: async () => ({ stale: false, updatedAt: '2026-11-20T09:00:00.000Z', row, field: 12 }), count: async () => null };
    const home = await readHome(c, A_IOANA);
    expect(home.lastCompetition).toEqual({ available: true, stale: false, updatedAt: '2026-11-20T09:00:00.000Z', row, field: 12 });
    expect(home.category).toBe('Advanced Novice Girls');
  });

  it('a failing source is the same as an unavailable one', async () => {
    const c = sportivCtx('sportiv18@example.invalid');
    c.competitions = { last: async () => { throw new Error('down'); }, count: async () => null };
    expect((await readHome(c, A_IOANA)).lastCompetition).toEqual({ available: false });
  });

  it('an inactive athlete is flagged and has no upcoming items', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    c.fake.group.athletes.find((a) => a.id === A_ANA)!.status = 'inactiv';
    const home = await readHome(c, A_ANA);
    expect(home.athlete.inactive).toBe(true);
    expect(home.upcoming).toEqual([]);
  });

  it('new season day one: 0 presences and the bars start at the season month', async () => {
    const c = sportivCtx('parinte1@example.invalid', '2026-10-01');
    const home = await readHome(c, A_ANA);
    expect(home.presences.total).toBe(0);
    expect(home.presences.months[0]).toEqual({ month: '2026-10', count: 0, state: 'current' });
  });
});

describe('the promotion moment', () => {
  it('the first read stores the level silently, with no promotion', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    expect((await readHome(c, A_ANA)).promotion).toBeNull();
    expect(c.accessFake.state.rows.find((r) => r.athleteId === A_ANA)?.levelSeenGroup).toBe('g-ib');
  });

  it('a move to a later group shows once, until the app says it was seen', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    c.accessFake.state.rows.find((r) => r.athleteId === A_ANA)!.levelSeenGroup = 'g-pp';
    const first = await readHome(c, A_ANA);
    expect(first.promotion).toEqual({ from: 'Primii Pași', to: 'Intermediari Bronze' });
    expect((await readHome(c, A_ANA)).promotion).toEqual(first.promotion); // not stored by a read
    expect(await markPromotionSeen(c, A_ANA)).toEqual({ ok: true });
    expect(c.accessFake.state.rows.find((r) => r.athleteId === A_ANA)?.levelSeenGroup).toBe('g-ib');
    expect((await readHome(c, A_ANA)).promotion).toBeNull();
  });

  it('a change to an earlier group is stored silently', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    c.accessFake.state.rows.find((r) => r.athleteId === A_ANA)!.levelSeenGroup = 'g-perf';
    expect((await readHome(c, A_ANA)).promotion).toBeNull();
    expect(c.accessFake.state.rows.find((r) => r.athleteId === A_ANA)?.levelSeenGroup).toBe('g-ib');
  });

  it('a revoked access neither shows nor stores a promotion', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    c.accessFake.state.rows.forEach((r) => { r.revokedAt = '2026-11-01T00:00:00.000Z'; r.revokeReason = 'scos'; });
    expect((await readHome(c, A_ANA)).promotion).toBeNull();
    expect(await markPromotionSeen(c, A_ANA)).toEqual({ ok: true });
  });
});

describe('the home answer', () => {
  it('carries nothing of the athlete row or the sources beyond the view', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    withPresences(c);
    c.fake.state.lessons.push(lessonRow({ id: 'l-p', athleteId: A_ANA, date: '2026-11-23', coachIds: ['tm-andreea'] }));
    c.accessFake.state.rows.find((r) => r.athleteId === A_ANA)!.levelSeenGroup = 'g-pp';
    const answer = await readHome(c, A_ANA);
    expect(JSON.stringify(answer)).not.toMatch(/Alergie|Părinte Secret|0722000111|example\.invalid|2017-04-02/);
    expect(forbiddenPathsIn(answer, [...SPORTIV_FORBIDDEN_KEYS, 'email', 'phone', 'birthDate', 'contactName'], SPORTIV_ALLOWED_PATHS)).toEqual([]);
  });
});
