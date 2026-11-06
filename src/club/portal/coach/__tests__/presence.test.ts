import { afterEach, describe, expect, it, vi } from 'vitest';
import { todayIso } from '../../../groups/http';
import { attendanceRow, sessionRow } from '../../../presence/__tests__/fake-store';
import { PORTAL_ERRORS } from '../../copy';
import { checkCoachSession, readCoachSession, saveCoachSession } from '../presence';
import { forbiddenKeysIn } from '../views';
import { coachCtx } from './coach-seed';

const TODAY = '2026-11-20';
const ME = 'tm-andreea';
const tick = (athleteId: string) => ({ athleteId, grup: true, uscat: false });
const CLUB_A_KEY = `ev-g-club-a|${TODAY}|17:00`;
const CLUB_B_KEY = `ev-g-club-b|${TODAY}|18:00`;
const body = (over: Record<string, unknown>) => ({ coachIds: [ME], ticks: [tick('a-club-1')], reactivate: [], keepInactive: [], ...over });
const ARCHIVED = { ok: false, status: 403, error: PORTAL_ERRORS.archived };
const NO_ACCESS = { ok: false, status: 403, error: PORTAL_ERRORS.noAccess };

const oldSession = (over = {}) => sessionRow({
  id: 's-old', groupId: 'g-club-a', date: '2026-10-06', startTime: '17:00', source: 'added', eventId: null, occurrenceKey: null, coachIds: [ME], ...over,
});
const withOld = (today: string) => {
  const c = coachCtx(ME, today);
  c.fake.state.sessions.push(oldSession());
  c.fake.state.attendances.push(attendanceRow({ id: 't-old', sessionId: 's-old', athleteId: 'a-club-1', uniqueKey: 's-old|a-club-1' }));
  return c;
};
const correct = (c: ReturnType<typeof coachCtx>) => saveCoachSession(c, body({ id: 's-old', ticks: [tick('a-club-1'), tick('a-club-2')] }));

afterEach(() => { vi.useRealTimers(); });

describe('own group', () => {
  it('saves, reads back with the saved line, writes the history line with the coach actor', async () => {
    const c = coachCtx(ME);
    const saved = await saveCoachSession(c, body({ occurrence: CLUB_A_KEY }));
    expect(saved).toMatchObject({ ok: true });
    const id = saved.ok ? (saved.data.value.sessionId) : '';
    const read = await readCoachSession(c, { id });
    expect(read).toMatchObject({ ok: true, data: { editable: true, archived: false, standIn: false, rows: [{ athleteId: 'a-club-1', grup: true }, { athleteId: 'a-club-2', grup: false }] } });
    if (read.ok) expect(read.data.savedLine).toMatch(/^Salvată de Antrenor Andreea Pascu, /);
    expect(c.fake.group.history.at(-1)?.actor).toBe('Antrenor Andreea Pascu');
  });

  it('a correction on day 7 passes, on day 8 answers archived and changes nothing', async () => {
    const ok = withOld('2026-10-13');
    expect(await correct(ok)).toMatchObject({ ok: true });
    expect(ok.fake.state.attendances.length).toBe(2);
    const late = withOld('2026-10-14');
    const before = structuredClone(late.fake.state.attendances);
    expect(await correct(late)).toEqual(ARCHIVED);
    expect(late.fake.state.attendances).toEqual(before);
    expect(await readCoachSession(late, { id: 's-old' })).toMatchObject({ ok: true, data: { archived: true, editable: false } });
  });

  it('the window edge uses Bucharest today (23:59 and 00:01 Bucharest, UTC+3 in October)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-13T20:59:00Z'));
    const before = withOld(todayIso());
    expect(await correct(before)).toMatchObject({ ok: true });
    vi.setSystemTime(new Date('2026-10-13T21:01:00Z'));
    const after = withOld(todayIso());
    expect(await correct(after)).toEqual(ARCHIVED);
  });

  it('answers no abonament text at Club and the used/total text at Școala, never a price', async () => {
    const club = await readCoachSession(coachCtx(ME), { occurrence: CLUB_A_KEY });
    expect(club).toMatchObject({ ok: true, data: { kind: 'club', rows: [{ abonament: null }, { abonament: null }] } });
    const school = await readCoachSession(coachCtx(ME), { occurrence: 'ev-g-scoala-a|2026-11-21|11:00' });
    expect(school).toMatchObject({ ok: true, data: { kind: 'school', rows: [{ athleteId: 'a-scoala-1', abonament: '0/8' }, { athleteId: 'a-scoala-2', abonament: 'Fără abonament' }] } });
    expect(forbiddenKeysIn(club)).toEqual([]);
    expect(forbiddenKeysIn(school)).toEqual([]);
  });
});

describe('stand-in on another coach group', () => {
  it('reads today class and the day 7 class, refuses an older one', async () => {
    const c = coachCtx(ME);
    expect(await readCoachSession(c, { occurrence: CLUB_B_KEY })).toMatchObject({ ok: true, data: { standIn: true, editable: true, coachIds: [ME], rows: [{ athleteId: 'a-b-1' }] } });
    expect(await readCoachSession(c, { occurrence: 'ev-g-club-b|2026-11-13|18:00' })).toMatchObject({ ok: true });
    expect(await readCoachSession(c, { occurrence: 'ev-g-club-b|2026-11-11|18:00' })).toEqual(NO_ACCESS);
  });

  it('saves only with herself in the coaches, then lists her and may correct', async () => {
    const c = coachCtx(ME);
    expect(await saveCoachSession(c, body({ occurrence: CLUB_B_KEY, coachIds: ['tm-virgil'], ticks: [tick('a-b-1')] }))).toEqual(NO_ACCESS);
    expect(c.fake.state.sessions).toEqual([]);
    const saved = await saveCoachSession(c, body({ occurrence: CLUB_B_KEY, coachIds: [ME, 'tm-virgil'], ticks: [tick('a-b-1')] }));
    expect(saved).toMatchObject({ ok: true });
    expect(c.fake.state.sessions[0].coachIds).toEqual([ME, 'tm-virgil']);
    const id = c.fake.state.sessions[0].id;
    expect(await saveCoachSession(c, body({ id, coachIds: [ME, 'tm-virgil'], ticks: [] }))).toMatchObject({ ok: true });
    expect(await saveCoachSession(c, body({ id, coachIds: ['tm-virgil'], ticks: [] }))).toEqual(NO_ACCESS);
  });

  it('cannot correct a saved session that does not list her, add a session, or check a new one', async () => {
    const c = coachCtx(ME);
    c.fake.state.sessions.push(sessionRow({ id: 's-b', groupId: 'g-club-b', date: TODAY, startTime: '18:00', eventId: 'ev-g-club-b', occurrenceKey: CLUB_B_KEY, coachIds: ['tm-virgil'] }));
    expect(await readCoachSession(c, { id: 's-b' })).toEqual(NO_ACCESS);
    expect(await saveCoachSession(c, body({ id: 's-b', ticks: [] }))).toEqual(NO_ACCESS);
    const added = { groupId: 'g-club-b', date: TODAY, startTime: '20:00', durationMin: 50 };
    expect(await saveCoachSession(c, body({ added, ticks: [] }))).toEqual(NO_ACCESS);
    expect(await checkCoachSession(c, { groupId: 'g-club-b', date: TODAY, startTime: '20:00' })).toEqual(NO_ACCESS);
    expect(await checkCoachSession(c, { groupId: 'g-club-a', date: TODAY, startTime: '17:00' })).toMatchObject({ ok: true, data: { kind: 'occurrence' } });
  });

  it('marks each saved row of the day with listed, true only when the coach is in its coaches', async () => {
    const c = coachCtx(ME);
    c.fake.state.sessions.push(
      sessionRow({ id: 's-mine', groupId: 'g-club-a', date: TODAY, startTime: '17:00', coachIds: [ME] }),
      sessionRow({ id: 's-other', groupId: 'g-club-a', date: TODAY, startTime: '19:00', source: 'added', eventId: null, occurrenceKey: null, coachIds: ['tm-virgil'] }),
    );
    const res = await checkCoachSession(c, { groupId: 'g-club-a', date: TODAY, startTime: '17:00' });
    expect(res).toMatchObject({ ok: true, data: { kind: 'existing', saved: [{ sessionId: 's-mine', listed: true }, { sessionId: 's-other', listed: false }] } });
  });

  it('cannot save a future date', async () => {
    const c = coachCtx(ME);
    expect(await saveCoachSession(c, body({ occurrence: 'ev-g-club-b|2026-11-25|18:00', coachIds: [ME] }))).toEqual(NO_ACCESS);
  });
});

describe('ticks and reactivation', () => {
  it('a child not on the list answers 400, a visitor added earlier stays tickable', async () => {
    const c = coachCtx(ME);
    expect(await saveCoachSession(c, body({ occurrence: CLUB_A_KEY, ticks: [tick('a-b-1')] }))).toMatchObject({ ok: false, status: 400 });
    c.fake.state.sessions.push(sessionRow({ id: 's-x', groupId: 'g-club-a', date: TODAY, startTime: '17:00', eventId: 'ev-g-club-a', occurrenceKey: CLUB_A_KEY, coachIds: [ME] }));
    c.fake.state.attendances.push(attendanceRow({ id: 't-v', sessionId: 's-x', athleteId: 'a-free', uniqueKey: 's-x|a-free', visitor: true }));
    expect(await saveCoachSession(c, body({ id: 's-x', ticks: [tick('a-club-1'), tick('a-free')] }))).toMatchObject({ ok: true });
  });

  it('an inactive child asks the phase 5 question, and saves with reactivate', async () => {
    const c = coachCtx(ME);
    c.fake.group.athletes.find((a) => a.id === 'a-club-2')!.status = 'inactiv';
    const ask = await saveCoachSession(c, body({ occurrence: CLUB_A_KEY, ticks: [tick('a-club-2')] }));
    expect(ask).toMatchObject({ ok: false, status: 409, inactive: [{ id: 'a-club-2' }] });
    expect(await saveCoachSession(c, body({ occurrence: CLUB_A_KEY, ticks: [tick('a-club-2')], reactivate: ['a-club-2'] }))).toMatchObject({ ok: true });
    expect(c.fake.group.athletes.find((a) => a.id === 'a-club-2')?.status).toBe('activ');
  });
});
