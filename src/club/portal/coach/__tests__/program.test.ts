import { describe, expect, it } from 'vitest';
import { PORTAL_ERRORS } from '../../copy';
import { coachAddProgram, coachChangeProgram, coachDeleteClass, coachEndProgram, coachProgramPublic, coachSetDate, readCoachProgram } from '../program';
import { forbiddenKeysIn } from '../views';
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
