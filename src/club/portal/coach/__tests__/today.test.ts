import { describe, expect, it } from 'vitest';
import { lessonRow, sessionRow } from '../../../presence/__tests__/fake-store';
import { PORTAL_ERRORS } from '../../copy';
import { forbiddenKeysIn } from '../views';
import { createCoachLesson } from '../lessons';
import { readToday } from '../today';
import { addOneOffClass, coachCtx } from './coach-seed';

const TODAY = '2026-11-20';
const data = <T>(r: { ok: boolean } & Record<string, unknown>): T => {
  if (!r.ok) throw new Error(`refused ${String(r.status)} ${String(r.error)}`);
  return r.data as T;
};
type Today = Awaited<ReturnType<typeof readToday>> extends infer R ? (R extends { ok: true; data: infer D } ? D : never) : never;
const read = async (c: ReturnType<typeof coachCtx>, date: unknown = TODAY): Promise<Today> => data<Today>(await readToday(c, date) as never);

const standInSession = sessionRow({
  id: 's-b', groupId: 'g-club-b', date: TODAY, startTime: '18:00', durationMin: 90, eventId: 'ev-g-club-b', occurrenceKey: `ev-g-club-b|${TODAY}|18:00`,
  coachIds: ['tm-andreea', 'tm-virgil'],
});

describe('readToday', () => {
  it('lists the classes of the own groups, not another group', async () => {
    const out = await read(coachCtx('tm-andreea'));
    expect(out.groups.map((g) => g.groupId)).toEqual(['g-club-a']);
    expect(out.groups[0]).toMatchObject({ groupName: 'Club A', startTime: '17:00', children: 2, done: false, standIn: false, sessionId: null });
    expect(out.date).toBe(TODAY);
    expect(forbiddenKeysIn(out)).toEqual([]);
  });

  it('the weekend shows the Școala class of the own group', async () => {
    const out = await read(coachCtx('tm-andreea'), '2026-11-21');
    expect(out.groups.map((g) => g.groupId)).toEqual(['g-scoala-a']);
  });

  it('a saved stand-in session that lists her appears with standIn, an unsaved one does not', async () => {
    const unsaved = await read(coachCtx('tm-andreea'));
    expect(unsaved.groups.some((g) => g.groupId === 'g-club-b')).toBe(false);
    const c = coachCtx('tm-andreea');
    c.fake.state.sessions.push(standInSession);
    const out = await read(c);
    expect(out.groups.find((g) => g.groupId === 'g-club-b')).toMatchObject({ standIn: true, done: true, sessionId: 's-b' });
    const other = coachCtx('tm-andreea');
    other.fake.state.sessions.push({ ...standInSession, coachIds: ['tm-virgil'] });
    expect((await read(other)).groups.some((g) => g.groupId === 'g-club-b')).toBe(false);
  });

  it('todo holds her past unsaved classes only, newest first', async () => {
    const c = coachCtx('tm-andreea');
    c.fake.state.sessions.push(sessionRow({
      id: 's-old', groupId: 'g-club-a', date: '2026-11-13', startTime: '17:00', eventId: 'ev-g-club-a', occurrenceKey: 'ev-g-club-a|2026-11-13|17:00', coachIds: ['tm-andreea'],
    }));
    const out = await read(c);
    expect(out.todo.length).toBeGreaterThan(0);
    expect(out.todo.every((r) => ['g-club-a', 'g-scoala-a'].includes(r.groupId) && !r.done && r.sessionId === null && r.date < TODAY)).toBe(true);
    expect(out.todo.some((r) => r.date === '2026-11-13' && r.groupId === 'g-club-a')).toBe(false);
    const dates = out.todo.map((r) => r.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it('lessons of the date whose coaches include her, done when recorded', async () => {
    const c = coachCtx('tm-andreea');
    c.fake.state.lessons.push(
      lessonRow({ id: 'l1', athleteId: 'a-club-1', date: TODAY, startTime: '16:00', durationMin: 50, coachIds: ['tm-andreea'], present: null }),
      lessonRow({ id: 'l2', athleteId: 'a-club-2', date: TODAY, startTime: '15:00', durationMin: 50, coachIds: ['tm-andreea'], state: 'saved', present: true }),
      lessonRow({ id: 'l3', athleteId: 'a-b-1', date: TODAY, startTime: '14:00', coachIds: ['tm-virgil'] }),
    );
    const out = await read(c);
    expect(out.lessons).toEqual([
      { lessonId: 'l2', athleteName: 'Bogdan Club', date: TODAY, startTime: '15:00', durationMin: 50, done: true },
      { lessonId: 'l1', athleteName: 'Ana Club', date: TODAY, startTime: '16:00', durationMin: 50, done: false },
    ]);
    expect(forbiddenKeysIn(out)).toEqual([]);
  });

  it('an empty day answers three empty lists', async () => {
    const out = await read(coachCtx('tm-andreea', TODAY, { startDate: null }), '2026-11-19');
    expect(out).toMatchObject({ groups: [], lessons: [], todo: [] });
  });

  it('an invalid date answers 400', async () => {
    expect(await readToday(coachCtx('tm-andreea'), '20-11-2026')).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.invalid });
    expect(await readToday(coachCtx('tm-andreea'), 5)).toMatchObject({ ok: false, status: 400 });
  });
});

describe('readToday location', () => {
  it('rows carry the section location', async () => {
    const c = coachCtx('tm-andreea');
    c.fake.group.sections.find((x) => x.id === 'club')!.locationName = 'Patinoar Club';
    const out = await read(c);
    expect(out.groups[0].location).toBe('Patinoar Club');
    expect((await read(coachCtx('tm-andreea'))).groups[0].location).toBeNull();
  });

  it('reads the sections once for all groups', async () => {
    const c = coachCtx('tm-andreea');
    const read = c.presence.store.sections;
    let calls = 0;
    c.presence.store.sections = async () => { calls += 1; return read(); };
    await readToday(c, TODAY);
    expect(calls).toBe(1);
  });
});

describe('repeating lessons and one-off classes in Azi', () => {
  it('a series lesson shows on its date as not done, a one-off class on its date, a removed date nowhere', async () => {
    const c = coachCtx('tm-andreea');
    const made = await createCoachLesson(c, { athleteId: 'a-club-1', date: '2026-11-20', startTime: '16:00', durationMin: 50, coachIds: ['tm-andreea'], repeat: { freq: 'weekly', days: ['fri'], until: '2026-11-27' } });
    expect(made).toMatchObject({ ok: true, data: { count: 2 } });
    addOneOffClass(c, '2026-11-25');
    const fri = await read(c);
    expect(fri.lessons).toEqual([{ lessonId: expect.any(String), athleteName: 'Ana Club', date: TODAY, startTime: '16:00', durationMin: 50, done: false }]);
    expect(forbiddenKeysIn(fri)).toEqual([]);
    const wed = await read(c, '2026-11-25');
    expect(wed.groups.map((g) => [g.groupId, g.startTime, g.done])).toEqual([['g-club-a', '15:00', false]]);
    c.fake.state.calendar.events.find((e) => e.documentId === 'ev-g-club-a')!.exceptions = [{ date: '2026-11-27', kind: 'sters' }];
    expect((await read(c, '2026-11-27')).groups).toEqual([]);
  });
});

describe('readToday next and week', () => {
  // Friday 20 November 2026, 12:00 in Bucharest; Club A on Fridays 17:00, Școala A on Saturdays and Sundays 11:00.
  it('a normal week: next is the Club A class today, three classes left, none held', async () => {
    const out = await read(coachCtx('tm-andreea'));
    expect(out.next).toEqual({ kind: 'grup', date: TODAY, startTime: '17:00', title: 'Club A', location: null, occurrenceKey: `ev-g-club-a|${TODAY}|17:00`, lessonId: null });
    expect(out.week).toEqual({ groupsHeld: 0, groupsLeft: 3, lessonsHeld: 0, lessonsLeft: 0, missing: 0 });
    expect(forbiddenKeysIn(out)).toEqual([]);
  });

  it('after the class started it counts as held, missing until saved; lessons count too and the next one is a lesson', async () => {
    const c = coachCtx('tm-andreea');
    c.presence.now = () => new Date(`${TODAY}T16:00:00.000Z`);
    c.fake.state.lessons.push(
      lessonRow({ id: 'l1', athleteId: 'a-club-1', date: '2026-11-18', startTime: '16:00', durationMin: 50, coachIds: ['tm-andreea'], present: null }),
      lessonRow({ id: 'l2', athleteId: 'a-club-2', date: '2026-11-21', startTime: '09:00', durationMin: 50, coachIds: ['tm-andreea'] }),
    );
    const out = await read(c);
    expect(out.week).toEqual({ groupsHeld: 1, groupsLeft: 2, lessonsHeld: 1, lessonsLeft: 1, missing: 0 });
    expect(out.next).toMatchObject({ kind: 'individual', date: '2026-11-21', startTime: '09:00', title: 'Bogdan Club', location: null, occurrenceKey: null, lessonId: 'l2' });
  });

  it('missing counts the past unsaved classes of this week only', async () => {
    const c = coachCtx('tm-andreea', '2026-11-22');
    const out = await read(c, '2026-11-22');
    expect(out.todo.filter((r) => r.date >= '2026-11-16').map((r) => r.date).length).toBe(out.week.missing);
    expect(out.week.missing).toBeGreaterThan(0);
  });

  it('a day with nothing next answers next null', async () => {
    expect((await read(coachCtx('tm-andreea', '2027-08-20'), '2027-08-20')).next).toBeNull();
  });

  it('a saved stand-in class is not counted in the week and is never next', async () => {
    const c = coachCtx('tm-andreea');
    c.fake.state.sessions.push(standInSession);
    const out = await read(c);
    expect(out.week).toEqual({ groupsHeld: 0, groupsLeft: 3, lessonsHeld: 0, lessonsLeft: 0, missing: 0 });
  });
});
