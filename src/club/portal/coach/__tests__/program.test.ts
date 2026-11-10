import { describe, expect, it } from 'vitest';
import { PORTAL_ERRORS } from '../../copy';
import { saveCoachSession } from '../presence';
import { coachAddProgram, coachChangeProgram, coachDeleteClass, coachEndProgram, coachProgramPublic, coachSetDate, readCoachProgram } from '../program';
import { forbiddenKeysIn } from '../views';
import { asCalendarRow } from '../../../groups/program-plan';
import { heldOccurrences } from '../../../presence/sessions';
import { coachCtx } from './coach-seed';

const ME = 'tm-andreea';
const NO_ACCESS = { ok: false, status: 403, error: PORTAL_ERRORS.noAccess };
const INVALID = { ok: false, status: 400, error: PORTAL_ERRORS.invalid };
const weekly = (over = {}) => ({ freq: 'weekly', days: ['mon'], startTime: '16:00', durationMin: 60, from: '2026-11-23', ...over });

function ctx() {
  const c = coachCtx(ME);
  let pings = 0;
  c.groups.revalidate = () => { pings += 1; };
  return { c, pings: () => pings };
}

describe('reading', () => {
  it('shows an own Club group editable with the switch, a school group read only, another coach group read only without the switch', async () => {
    const { c } = ctx();
    const club = await readCoachProgram(c, 'g-club-a', '2026-11');
    expect(club).toMatchObject({ ok: true, data: { kind: 'club', editable: true, programPublic: true } });
    if (club.ok) expect(club.data.occurrences.length).toBeGreaterThan(0);
    if (club.ok) expect(new Set(club.data.occurrences.map((o) => o.groupId))).toEqual(new Set(['g-club-a']));
    expect(await readCoachProgram(c, 'g-scoala-a', '2026-11')).toMatchObject({ ok: true, data: { kind: 'school', editable: false, programPublic: null } });
    expect(await readCoachProgram(c, 'g-club-b', '2026-11')).toMatchObject({ ok: true, data: { editable: false, programPublic: null } });
    expect(forbiddenKeysIn(club)).toEqual([]);
  });

  it('keeps the internal class note for an own group and drops it for another coach group', async () => {
    const { c } = ctx();
    for (const e of c.fake.state.calendar.events) e.description = `Nota ${e.group?.documentId}`;
    const own = await readCoachProgram(c, 'g-club-a', '2026-11');
    const other = await readCoachProgram(c, 'g-club-b', '2026-11');
    if (!own.ok || !other.ok) throw new Error('read refused');
    expect(own.data.occurrences.length).toBeGreaterThan(0);
    expect(other.data.occurrences.length).toBeGreaterThan(0);
    expect(own.data.occurrences.every((o) => o.description === 'Nota g-club-a')).toBe(true);
    expect(other.data.occurrences.every((o) => !o.description)).toBe(true);
    expect(JSON.stringify(other)).not.toContain('Nota');
  });

  it('answers 404 for an unknown or inactive group and 400 for a bad month', async () => {
    const { c } = ctx();
    expect(await readCoachProgram(c, 'nope', '2026-11')).toMatchObject({ ok: false, status: 404 });
    expect(await readCoachProgram(c, 'g-old', '2026-11')).toMatchObject({ ok: false, status: 404 });
    expect(await readCoachProgram(c, 'g-club-a', 'x')).toMatchObject({ ok: false, status: 400 });
  });
});

describe('writes', () => {
  it('adds a weekly program to an own Club group with the coach actor and a website ping, no undo in the answer', async () => {
    const { c, pings } = ctx();
    const res = await coachAddProgram(c, 'g-club-a', weekly());
    expect(res).toMatchObject({ ok: true, data: { eventId: expect.any(String) } });
    expect(JSON.stringify(res)).not.toContain('actionId');
    expect(c.fake.group.events.filter((e) => e.groupId === 'g-club-a')).toHaveLength(2);
    expect(c.fake.group.history.at(-1)).toMatchObject({ actor: 'Antrenor Andreea Pascu', subjectId: 'g-club-a' });
    expect(pings()).toBe(1);
  });

  it('refuses a school group and another coach group with 403, writing nothing', async () => {
    const { c, pings } = ctx();
    expect(await coachAddProgram(c, 'g-scoala-a', weekly())).toEqual(NO_ACCESS);
    expect(await coachAddProgram(c, 'g-club-b', weekly())).toEqual(NO_ACCESS);
    expect(await coachChangeProgram(c, 'ev-g-club-b', weekly())).toEqual(NO_ACCESS);
    expect(await coachEndProgram(c, 'ev-g-scoala-a', { from: '2026-11-23' })).toEqual(NO_ACCESS);
    expect(await coachSetDate(c, 'ev-g-club-b', '2026-11-25', { mode: 'cancel' })).toEqual(NO_ACCESS);
    expect(await coachDeleteClass(c, 'ev-g-scoala-a')).toEqual(NO_ACCESS);
    expect(await coachAddProgram(c, 'nope', weekly())).toMatchObject({ ok: false, status: 404 });
    expect(c.fake.group.history).toEqual([]);
    expect(pings()).toBe(0);
  });

  it('cancels a future date, queues the schedule-change jobs when notify is on, and refuses a past date', async () => {
    const { c, pings } = ctx();
    const res = await coachSetDate(c, 'ev-g-club-a', '2026-11-27', { mode: 'cancel', reason: 'Concurs', notifyParents: true });
    expect(res).toMatchObject({ ok: true, data: { mode: 'cancel', date: '2026-11-27', emails: 1 } });
    expect(JSON.stringify(res)).not.toContain('actionId');
    expect(c.fake.group.jobs.length).toBe(1);
    expect(c.fake.group.history.at(-1)?.actor).toBe('Antrenor Andreea Pascu');
    expect(pings()).toBe(1);
    expect(await coachSetDate(c, 'ev-g-club-a', '2026-11-13', { mode: 'cancel' })).toEqual(INVALID);
    expect(await coachSetDate(c, 'ev-g-club-a', '2026-11-27', { mode: 'move', newDate: '2026-11-10', newStartTime: '17:00' })).toEqual(INVALID);
  });

  it('refuses a past "from" on add, change and end', async () => {
    const { c } = ctx();
    expect(await coachAddProgram(c, 'g-club-a', weekly({ from: '2026-11-19' }))).toEqual(INVALID);
    expect(await coachChangeProgram(c, 'ev-g-club-a', weekly({ from: '2026-11-19' }))).toEqual(INVALID);
    expect(await coachEndProgram(c, 'ev-g-club-a', { from: '2026-11-19' })).toEqual(INVALID);
    expect(c.fake.group.history).toEqual([]);
  });

  it('ends and changes a series from a future date through the admin services', async () => {
    const { c, pings } = ctx();
    const changed = await coachChangeProgram(c, 'ev-g-club-a', weekly({ days: ['fri'], from: '2026-11-27' }));
    expect(changed).toMatchObject({ ok: true });
    expect(await coachEndProgram(c, changed.ok ? changed.data.eventId : '', { from: '2026-12-11' })).toMatchObject({ ok: true });
    expect(c.fake.group.history.map((h) => h.actor)).toEqual(['Antrenor Andreea Pascu', 'Antrenor Andreea Pascu']);
    expect(pings()).toBe(2);
  });

  it('deletes a one-off class on a future date, not a past one', async () => {
    const { c } = ctx();
    const added = await coachAddProgram(c, 'g-club-a', { repeat: false, date: '2026-11-30', startTime: '16:00', durationMin: 60 });
    const id = added.ok ? added.data.eventId : '';
    expect(await coachDeleteClass(c, id)).toMatchObject({ ok: true, data: { date: '2026-11-30' } });
    c.fake.group.events.push({ ...c.fake.group.events[0], id: 'ev-past', recurrence: { ...c.fake.group.events[0].recurrence, freq: 'none', singleDate: '2026-11-10' } });
    expect(await coachDeleteClass(c, 'ev-past')).toEqual(INVALID);
  });
});

describe('Program public', () => {
  it('writes the Da to Nu line and pings, then nothing for the same value', async () => {
    const { c, pings } = ctx();
    expect(await coachProgramPublic(c, 'g-club-a', { value: false })).toEqual({ ok: true, data: { toast: 'Salvat.' } });
    expect(c.fake.group.history.at(-1)).toMatchObject({ actor: 'Antrenor Andreea Pascu', changes: { fields: { programPublic: { from: true, to: false } } } });
    expect(pings()).toBe(1);
    await coachProgramPublic(c, 'g-club-a', { value: false });
    expect(c.fake.group.history).toHaveLength(1);
    expect(pings()).toBe(1);
  });

  it('is for an own Club group only, with a boolean value', async () => {
    const { c } = ctx();
    expect(await coachProgramPublic(c, 'g-scoala-a', { value: false })).toEqual(NO_ACCESS);
    expect(await coachProgramPublic(c, 'g-club-b', { value: false })).toEqual(NO_ACCESS);
    expect(await coachProgramPublic(c, 'g-club-a', { value: 'nu' })).toEqual(INVALID);
    expect(await coachProgramPublic(c, 'nope', { value: true })).toMatchObject({ ok: false, status: 404 });
  });
});

const tueThu = (over = {}) => weekly({ days: ['tue', 'thu'], from: '2026-11-24', ...over });
const rulesOf = async (c: ReturnType<typeof ctx>['c'], id = 'g-club-a') => {
  const res = await readCoachProgram(c, id, '2026-11');
  if (!res.ok) throw new Error('read refused');
  return res.data.rules;
};

describe('rules per weekday', () => {
  it('lists one rule per weekday of each series, Monday first, with the next class date', async () => {
    const { c } = ctx();
    await coachAddProgram(c, 'g-club-a', tueThu());
    const rules = await rulesOf(c);
    expect(rules.map((r) => r.day)).toEqual(['tue', 'thu', 'fri']);
    expect(rules[0]).toMatchObject({ day: 'tue', freq: 'weekly', startTime: '16:00', durationMin: 60, from: '2026-11-24', to: '2027-05-31', untilSeasonEnd: true, nextDate: '2026-11-24' });
    expect(rules[1]).toMatchObject({ day: 'thu', nextDate: '2026-11-26' });
    expect(rules[2]).toMatchObject({ day: 'fri', nextDate: '2026-11-20' });
    expect(forbiddenKeysIn(await readCoachProgram(c, 'g-club-a', '2026-11'))).toEqual([]);
  });

  it('a series added with "Până la" is not until the season end', async () => {
    const { c } = ctx();
    expect(await coachAddProgram(c, 'g-club-a', tueThu({ until: '2027-03-31' }))).toMatchObject({ ok: true });
    const rules = await rulesOf(c);
    expect(rules.filter((r) => r.day !== 'fri').map((r) => [r.to, r.untilSeasonEnd])).toEqual([['2027-03-31', false], ['2027-03-31', false]]);
    expect(rules.find((r) => r.day === 'fri')?.untilSeasonEnd).toBe(true);
  });

  it('refuses an until in the past or before from, writing nothing', async () => {
    const { c } = ctx();
    expect(await coachAddProgram(c, 'g-club-a', tueThu({ until: '2026-11-19' }))).toEqual(INVALID);
    expect(await coachAddProgram(c, 'g-club-a', tueThu({ until: '2026-11-23' }))).toMatchObject({ ok: false, status: 400 });
    expect(c.fake.group.history).toEqual([]);
  });

  it('ends one weekday from a date: only the other weekday goes on, from its next class', async () => {
    const { c } = ctx();
    const added = await coachAddProgram(c, 'g-club-a', tueThu());
    expect(await coachEndProgram(c, added.ok ? added.data.eventId : '', { from: '2026-11-24', day: 'tue' })).toMatchObject({ ok: true });
    const rules = await rulesOf(c);
    expect(rules.map((r) => [r.day, r.from, r.to])).toEqual([['thu', '2026-11-26', '2027-05-31'], ['fri', '2026-10-02', '2027-05-31']]);
  });

  it('shows no rule that has ended before today', async () => {
    const { c } = ctx();
    const done = structuredClone(c.fake.group.events[0]);
    c.fake.group.events.push({ ...done, id: 'ev-old', recurrence: { ...done.recurrence, days: ['mon'], seasonStart: '2026-10-05', seasonEnd: '2026-11-19' } });
    c.fake.state.calendar.events.push({ ...c.fake.state.calendar.events[0], documentId: 'ev-old' });
    expect((await rulesOf(c)).map((r) => r.day)).toEqual(['fri']);
  });

  it('nextDate skips a removed, a cancelled and a date moved to another weekday', async () => {
    const { c } = ctx();
    const added = await coachAddProgram(c, 'g-club-a', tueThu());
    const id = added.ok ? added.data.eventId : '';
    const next = async () => Object.fromEntries((await rulesOf(c)).filter((r) => r.day !== 'fri').map((r) => [r.day, r.nextDate]));
    expect(await next()).toEqual({ tue: '2026-11-24', thu: '2026-11-26' });
    await coachSetDate(c, id, '2026-11-24', { mode: 'remove' });
    await coachSetDate(c, id, '2026-11-26', { mode: 'cancel', reason: null });
    expect(await next()).toEqual({ tue: '2026-12-01', thu: '2026-12-03' });
    await coachSetDate(c, id, '2026-12-01', { mode: 'move', newDate: '2026-12-02', newStartTime: '16:00' });
    expect((await next()).tue).toBe('2026-12-08');
    await coachSetDate(c, id, '2026-12-08', { mode: 'move', newDate: '2026-12-09', newStartTime: '16:00' });
    expect((await next()).tue).toBe('2026-12-15');
  });

  it('a day the series does not run on is 400', async () => {
    const { c } = ctx();
    expect(await coachEndProgram(c, 'ev-g-club-a', { from: '2026-12-01', day: 'tue' })).toEqual(INVALID);
    expect(await coachChangeProgram(c, 'ev-g-club-a', weekly({ days: ['fri'], from: '2026-12-01', day: 'tue' }))).toEqual(INVALID);
  });

  it('another coach group is read only but its rules are shown, notes still dropped', async () => {
    const { c } = ctx();
    const res = await readCoachProgram(c, 'g-club-b', '2026-11');
    if (!res.ok) throw new Error('read refused');
    expect(res.data.rules.map((r) => r.day)).toEqual(['wed', 'fri']);
    expect(res.data.occurrences.every((o) => o.description === null)).toBe(true);
    expect(forbiddenKeysIn(res)).toEqual([]);
  });
});

describe('removed dates', () => {
  it('removes a future date of an own Club series', async () => {
    const { c } = ctx();
    expect(await coachSetDate(c, 'ev-g-club-a', '2026-11-27', { mode: 'remove' })).toEqual({ ok: true, data: { mode: 'remove', date: '2026-11-27', emails: 0 } });
    expect(c.fake.group.events.find((e) => e.id === 'ev-g-club-a')?.exceptions.map((x) => x.kind)).toEqual(['sters']);
  });

  it('is refused on a school group, another coach group and a past date', async () => {
    const { c } = ctx();
    expect(await coachSetDate(c, 'ev-g-scoala-a', '2026-11-28', { mode: 'remove' })).toEqual(NO_ACCESS);
    expect(await coachSetDate(c, 'ev-g-club-b', '2026-11-27', { mode: 'remove' })).toEqual(NO_ACCESS);
    expect(await coachSetDate(c, 'ev-g-club-a', '2026-11-13', { mode: 'remove' })).toEqual(INVALID);
  });

  it('a date with a saved session is 409 with the refusal text', async () => {
    const { c } = ctx();
    c.fake.state.sessions.push({ id: 's1', groupId: 'g-club-a', eventId: 'ev-g-club-a', date: '2026-11-27', startTime: '17:00' } as never);
    expect(await coachSetDate(c, 'ev-g-club-a', '2026-11-27', { mode: 'remove' })).toMatchObject({ ok: false, status: 409, error: 'Data are prezența salvată. Poți doar să o anulezi.' });
  });
});

describe('a one-off class in the last 7 days (user ruling 2026-11-10)', () => {
  const one = (date: string) => ({ repeat: false, date, startTime: '16:00', durationMin: 60 });

  it('3 days ago: added, in Istoric and in the presence occurrences', async () => {
    const { c } = ctx();
    const res = await coachAddProgram(c, 'g-club-a', one('2026-11-17'));
    expect(res).toMatchObject({ ok: true, data: { date: '2026-11-17' } });
    expect(c.fake.group.history.at(-1)).toMatchObject({ action: 'class-added', actor: 'Antrenor Andreea Pascu', changes: { date: '2026-11-17' } });
    const added = c.fake.group.events.find((e) => e.id === (res.ok ? res.data.eventId : ''));
    if (!added) throw new Error('not written');
    const held = heldOccurrences({ events: [asCalendarRow(added, 'Club A')], blackouts: [] }, c.fake.group.groups, '2026-11-17', '2026-11-17');
    expect(held.map((h) => [h.date, h.startTime])).toEqual([['2026-11-17', '16:00']]);
  });

  it('today and the 7th day back are fine, 8 days ago is 400', async () => {
    const { c } = ctx();
    expect(await coachAddProgram(c, 'g-club-a', one('2026-11-20'))).toMatchObject({ ok: true });
    expect(await coachAddProgram(c, 'g-club-a', one('2026-11-13'))).toMatchObject({ ok: true });
    expect(await coachAddProgram(c, 'g-club-a', one('2026-11-12'))).toEqual(INVALID);
  });

  it('a repeating series from yesterday is still 400', async () => {
    const { c } = ctx();
    expect(await coachAddProgram(c, 'g-club-a', weekly({ from: '2026-11-19' }))).toEqual(INVALID);
  });
});

describe('fix round A through the coach', () => {
  /** The presence reads the calendar rows; the fakes keep them apart from the program's events, so copy them over before a save. */
  const sync = (c: ReturnType<typeof coachCtx>) => {
    c.fake.state.calendar.events = c.fake.group.events.map((e) => asCalendarRow(e, c.fake.group.groups.find((g) => g.id === e.groupId)?.name ?? ''));
  };
  const sat = (c: ReturnType<typeof coachCtx>, key: string) => (sync(c), saveCoachSession(c, { occurrence: key, coachIds: [ME], ticks: [{ athleteId: 'a-club-1', grup: true, uscat: false }], reactivate: [], keepInactive: [] }));

  it('a saved session on the kept weekday follows the split: a second save writes no second session or rows', async () => {
    const c = coachCtx(ME, '2026-11-26');
    const added = await coachAddProgram(c, 'g-club-a', { ...tueThu({ from: '2026-11-26' }) });
    const id = added.ok ? added.data.eventId : '';
    expect(await sat(c, `${id}|2026-11-26|16:00`)).toMatchObject({ ok: true });
    expect(await coachEndProgram(c, id, { from: '2026-11-26', day: 'tue' })).toMatchObject({ ok: true });
    const rest = c.fake.group.events.find((e) => e.groupId === 'g-club-a' && e.id !== id && e.id !== 'ev-g-club-a')!;
    expect(c.fake.state.sessions[0]).toMatchObject({ eventId: rest.id, occurrenceKey: `${rest.id}|2026-11-26|16:00` });
    const rows = c.fake.state.attendances.length;
    expect(await sat(c, `${rest.id}|2026-11-26|16:00`)).toMatchObject({ ok: true });
    expect([c.fake.state.sessions.length, c.fake.state.attendances.length]).toEqual([1, rows]);
  });

  it('remove then save, and save then remove: one session at most, never one on a removed date', async () => {
    const first = coachCtx(ME);
    expect(await sat(first, 'ev-g-club-a|2026-11-20|17:00')).toMatchObject({ ok: true });
    expect(await coachSetDate(first, 'ev-g-club-a', '2026-11-20', { mode: 'remove' })).toMatchObject({ ok: false, status: 409 });
    const second = coachCtx(ME);
    expect(await coachSetDate(second, 'ev-g-club-a', '2026-11-20', { mode: 'remove' })).toMatchObject({ ok: true });
    expect((await sat(second, 'ev-g-club-a|2026-11-20|17:00')).ok).toBe(false);
    expect(second.fake.state.sessions).toEqual([]);
    expect(first.fake.group.locks).toEqual(expect.arrayContaining(['group:g-club-a', 'event:ev-g-club-a']));
  });

  it('a coach deletes his one-off class from the last 7 days when no presence is saved, else 409', async () => {
    const { c } = ctx();
    const added = await coachAddProgram(c, 'g-club-a', { repeat: false, date: '2026-11-15', startTime: '16:00', durationMin: 60 });
    const id = added.ok ? added.data.eventId : '';
    expect(await coachDeleteClass(c, id)).toMatchObject({ ok: true, data: { date: '2026-11-15' } });
    const again = await coachAddProgram(c, 'g-club-a', { repeat: false, date: '2026-11-15', startTime: '16:00', durationMin: 60 });
    const id2 = again.ok ? again.data.eventId : '';
    c.fake.state.sessions.push({ id: 's1', groupId: 'g-club-a', eventId: id2, date: '2026-11-15', startTime: '16:00' } as never);
    expect(await coachDeleteClass(c, id2)).toMatchObject({ ok: false, status: 409, error: 'Data are prezența salvată. Poți doar să o anulezi.' });
    c.fake.group.events.push({ ...c.fake.group.events.find((e) => e.id === id2)!, id: 'old', recurrence: { ...c.fake.group.events.find((e) => e.id === id2)!.recurrence, singleDate: '2026-11-12' } });
    expect(await coachDeleteClass(c, 'old')).toEqual(INVALID);
  });
});
