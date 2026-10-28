import { describe, expect, it } from 'vitest';
import { respondSave, saveSession } from '../attendance/save';
import { UniqueKeyError } from '../store';
import { athleteLines, attendanceSeed, fakeCtx, ok, sessionLines, setPrice, withSaved14 } from './attendance-seed';
import type { FakePresenceContext } from './fake-store';

type Seed = FakePresenceContext;
const save = (f: Seed, body: object) => saveSession(f.ctx, { coachIds: ['tm-virgil'], reactivate: [], keepInactive: [], ...body });
const grup = (athleteId: string) => ({ athleteId, grup: true, uscat: false });
const sessionIdOf = (r: Awaited<ReturnType<typeof save>>): string => ok(r).value.sessionId;

describe('saveSession', () => {
  it('first save of a Școala occurrence: session, slots, line, toast, no undo (4.4, 4.10, 8, C46)', async () => {
    const f = attendanceSeed();
    const r = await save(f, { occurrence: 'ev-ib|2026-11-14|11:00', ticks: [grup('a1'), grup('a2')] });
    expect(r).toEqual({ ok: true, data: { value: { sessionId: expect.any(String), toast: 'Prezență salvată: Intermediari Bronze, 14 noi.' }, actionId: null } });
    expect(f.state.sessions[0]).toMatchObject({
      groupId: 'g-ib', seasonId: 's26', date: '2026-11-14', startTime: '11:00', durationMin: 50, source: 'schedule', eventId: 'ev-ib',
      occurrenceKey: 'ev-ib|2026-11-14|11:00', outsideSchedule: false, coachIds: ['tm-virgil'], savedBy: 'Ana Admin',
    });
    expect(f.state.attendances.map((a) => [a.athleteId, a.billing, a.subscriptionId])).toEqual([['a1', 'slot', 'sub-a1'], ['a2', 'fara_abonament', null]]);
    expect(sessionLines(f)).toEqual(['Prezență salvată: 2 din 3, antrenor Virgil Pascu.']);
  });

  it('Club save at member and non-member prices; correction lines (4.12, 4.13, 8)', async () => {
    const f = attendanceSeed();
    const id = sessionIdOf(await save(f, { occurrence: 'ev-club|2026-11-13|17:00', ticks: [{ athleteId: 'a5', grup: true, uscat: true }, grup('a6')] }));
    expect(f.state.attendances.map((a) => [a.athleteId, a.audience, a.amount])).toEqual([['a5', 'nonMember', 75], ['a6', 'member', 40]]);
    setPrice(f, 'pl-club', 'Ședință grup', { nonMemberPrice: 60 });
    await save(f, { id, coachIds: ['tm-virgil', 'tm-andreea'], ticks: [{ athleteId: 'a5', grup: true, uscat: true }, { athleteId: 'a6', grup: true, uscat: true }] });
    expect(f.state.attendances.find((a) => a.athleteId === 'a5')?.amount).toBe(75);
    expect(f.state.attendances.find((a) => a.athleteId === 'a6')?.amount).toBe(60);
    expect(sessionLines(f).slice(1)).toEqual(['Prezență corectată. Uscat bifat: Luca Marin.', 'Antrenori: "Virgil Pascu" → "Virgil Pascu, Andreea Pascu"']);
  });

  it('untick frees the slot; a save with no change writes nothing (C25, decided 5)', async () => {
    const f = attendanceSeed();
    const id = sessionIdOf(await save(f, { occurrence: 'ev-ib|2026-11-14|11:00', ticks: [grup('a1')] }));
    const before = f.group.history.length;
    await save(f, { id, ticks: [grup('a1')] });
    expect(f.group.history.length).toBe(before);
    await save(f, { id, ticks: [] });
    expect(f.state.attendances).toEqual([]);
    expect(sessionLines(f).at(-1)).toBe('Prezență corectată. Sportiv scos: Ana Ionescu.');
    expect(f.state.sessions).toHaveLength(1);
  });

  it('two sessions the same day use two slots (4.8)', async () => {
    const f = attendanceSeed();
    await save(f, { occurrence: 'ev-ib|2026-11-14|11:00', ticks: [grup('a1')] });
    await save(f, { added: { groupId: 'g-ib', date: '2026-11-14', startTime: '15:00', durationMin: 50 }, ticks: [grup('a1')] });
    expect(f.state.attendances.map((a) => a.subscriptionId)).toEqual(['sub-a1', 'sub-a1']);
    expect(f.state.sessions[1]).toMatchObject({ source: 'added', eventId: null, occurrenceKey: null, outsideSchedule: false });
  });

  it('the same added session saved again within 10 s is not created twice (final review M2)', async () => {
    const f = attendanceSeed();
    const added = { groupId: 'g-ib', date: '2026-11-14', startTime: '15:00', durationMin: 50 };
    const first = sessionIdOf(await save(f, { added, ticks: [grup('a1')] }));
    const again = sessionIdOf(await save(f, { added, ticks: [grup('a1')] }));
    expect(again).toBe(first);
    expect(f.state.sessions).toHaveLength(1);
    expect(f.state.attendances).toHaveLength(1);
    await save(f, { added: { ...added, startTime: '16:00' }, ticks: [] });
    expect(f.state.sessions).toHaveLength(2);
    f.advance(11_000);
    await save(f, { added, ticks: [] });
    expect(f.state.sessions).toHaveLength(3);
  });

  it('a visitor: flagged, own abonament only when valid for the list, athlete line (4.7, p5 Q16)', async () => {
    const f = attendanceSeed();
    await save(f, { occurrence: 'ev-ib|2026-11-14|11:00', ticks: [grup('a7')] });
    expect(f.state.attendances[0]).toMatchObject({ athleteId: 'a7', visitor: true, billing: 'fara_abonament' });
    expect(athleteLines(f, 'a7')).toEqual(['Prezent la Intermediari Bronze, 14 noi 2026, doar la ședința asta.']);
  });

  it('an inactive athlete: 409 with the list, then reactivate or keep (4.22)', async () => {
    const f = attendanceSeed();
    const body = { occurrence: 'ev-ib|2026-11-14|11:00', ticks: [grup('a3')] };
    expect(await save(f, body)).toEqual({ ok: false, status: 409, error: 'Sportiv inactiv', inactive: [{ id: 'a3', name: 'Ioana Dinu' }] });
    expect([f.state.sessions, f.state.attendances]).toEqual([[], []]);
    ok(await save(f, { ...body, reactivate: ['a3'] }));
    expect(f.group.athletes.find((a) => a.id === 'a3')?.status).toBe('activ');
    expect(athleteLines(f, 'a3')).toContain('Reactivat');
    const g = attendanceSeed();
    ok(await save(g, { ...body, keepInactive: ['a3'] }));
    expect(g.group.athletes.find((a) => a.id === 'a3')?.status).toBe('inactiv');
  });

  it('refuses bad ticks, no coach, no season (5.3, decided 8)', async () => {
    const f = attendanceSeed();
    const o = { occurrence: 'ev-ib|2026-11-14|11:00' };
    expect(await save(f, { ...o, coachIds: [], ticks: [grup('a1')] })).toEqual({ ok: false, status: 400, error: 'Alege antrenorul.' });
    expect((await save(f, { ...o, coachIds: ['tm-nobody'], ticks: [grup('a1')] })).ok).toBe(false);
    for (const ticks of [[grup('a9')], [grup('nope')], [grup('a1'), grup('a1')], [{ athleteId: 'a1', grup: 'da' }]]) {
      expect((await save(f, { ...o, ticks })).ok, JSON.stringify(ticks)).toBe(false);
    }
    expect((await save(f, { added: { groupId: 'g-ib', date: '2024-01-06', startTime: '11:00', durationMin: 50 }, ticks: [] })).ok).toBe(false);
    expect((await save(f, { added: { groupId: 'g-ib', date: '2026-11-17', startTime: '11:00', durationMin: 3 }, ticks: [] })).ok).toBe(false);
    expect(f.state.sessions).toEqual([]);
  });

  it('a duplicate occurrence key answers 409 and writes nothing (3.10)', async () => {
    const f = attendanceSeed();
    f.store.createSession = async () => { throw new UniqueKeyError('dup'); };
    expect(await save(f, { occurrence: 'ev-ib|2026-11-14|11:00', ticks: [grup('a1')] })).toEqual({ ok: false, status: 409, error: 'Prezența s-a schimbat între timp. Reîncarcă.' });
    expect(f.state.attendances).toEqual([]);
  });

  it('an occurrence saved meanwhile is corrected, not duplicated', async () => {
    const f = withSaved14(attendanceSeed());
    ok(await save(f, { occurrence: 'ev-ib|2026-11-14|11:00', ticks: [grup('a1'), grup('a2')] }));
    expect(f.state.sessions.filter((s) => s.occurrenceKey === 'ev-ib|2026-11-14|11:00')).toHaveLength(1);
  });

  it('rolls back on a failure (7.2)', async () => {
    const f = attendanceSeed();
    f.failOn('createAttendance');
    expect(await save(f, { occurrence: 'ev-ib|2026-11-14|11:00', ticks: [grup('a1')] })).toEqual({ ok: false, status: 500, error: 'Acțiunea nu a reușit. Nimic nu a fost salvat.' });
    expect(f.state.sessions).toEqual([]);
  });

  it('locks the session, then athletes, then subscriptions (7.1)', async () => {
    const f = withSaved14(attendanceSeed());
    await save(f, { id: 's14', ticks: [grup('a2'), grup('a1')] });
    expect(f.group.locks).toEqual(['session:s14', 'athlete:a1', 'athlete:a2', 'athlete:a7', 'subscription:sub-a1']);
  });
});

describe('respondSave', () => {
  it('answers the inactive 409 with details (decided 2)', () => {
    const ctx = fakeCtx();
    respondSave(ctx, { ok: false, status: 409, error: 'Sportiv inactiv', inactive: [{ id: 'a3', name: 'Ioana Dinu' }] });
    expect([ctx.status, ctx.body]).toEqual([409, { data: null, error: { status: 409, name: 'ClubAdminError', message: 'Sportiv inactiv', details: { inactive: [{ id: 'a3', name: 'Ioana Dinu' }] } } }]);
  });

  it('answers a saved session like any action', () => {
    const ctx = fakeCtx();
    respondSave(ctx, { ok: true, data: { value: { sessionId: 's1', toast: 't' }, actionId: null } });
    expect(ctx.body).toEqual({ data: { sessionId: 's1', toast: 't' }, undo: null });
  });
});
