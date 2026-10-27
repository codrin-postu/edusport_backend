import { describe, expect, it } from 'vitest';
import type { AdminResult } from '../../admin-result';
import { createLesson } from '../lessons/create';
import { deleteLesson } from '../lessons/delete';
import { listLessons, newLessonDefaults, readLesson } from '../lessons/read';
import { saveLesson } from '../lessons/save';
import { undoPresenceAction } from '../undo-service';
import { attendanceSeed, lessonLines, setPrice } from './attendance-seed';
import { lessonRow, paymentRow } from './fake-store';

function ok<T>(r: AdminResult<T>): T {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r)}`);
  return r.data;
}

const body = (over: object = {}) => ({ athleteId: 'a5', date: '2026-11-25', startTime: '18:00', durationMin: 50, coachIds: ['tm-virgil'], ...over });

describe('individual lessons', () => {
  it('a future lesson is planned, with its line and an undo (5.5, 8, 7.3)', async () => {
    const f = attendanceSeed();
    const r = await createLesson(f.ctx, body());
    expect(r).toEqual({ ok: true, data: { value: { lessonId: expect.any(String), changed: true, toast: 'Salvat.' }, actionId: expect.any(String) } });
    expect(f.state.lessons[0]).toMatchObject({ state: 'planned', present: null, price: null, amount: 0, createdByName: 'Ana Admin', durationMin: 50 });
    expect(lessonLines(f)).toEqual(['Lecție programată: 25 noi 2026, 18:00, 50 min.']);
    expect(ok(await undoPresenceAction(f.ctx, { actionId: ok(r).actionId }))).toEqual({ undone: true });
    expect(f.state.lessons).toEqual([]);
  });
  it('a lesson today is held and priced from the main group list (C47, 5.5, 4.13)', async () => {
    const f = attendanceSeed();
    await createLesson(f.ctx, body({ date: '2026-11-20' }));
    expect(f.state.lessons[0]).toMatchObject({ state: 'saved', present: true, priceListId: 'pl-club', itemName: 'Lecție individuală', price: 100, audience: 'nonMember', amount: 100, savedBy: 'Ana Admin' });
    expect(lessonLines(f)).toEqual(['Lecție programată: 20 noi 2026, 18:00, 50 min.', 'Lecție salvată: prezent.']);
    await createLesson(f.ctx, body({ athleteId: 'a6', date: '2026-11-20' }));
    expect(f.state.lessons[1]).toMatchObject({ audience: 'member', price: 80, amount: 80 });
  });
  it('no individual item in the list: no price (p5 Q27)', async () => {
    const f = attendanceSeed();
    await createLesson(f.ctx, body({ athleteId: 'a1', date: '2026-11-20' }));
    expect(f.state.lessons[0]).toMatchObject({ present: true, priceListId: 'pl-std', itemName: null, price: null, amount: 0 });
  });
  it('saved absent, then present: priced then, never re-priced (C48, C73)', async () => {
    const f = attendanceSeed();
    const id = ok(await createLesson(f.ctx, body())).value.lessonId;
    ok(await saveLesson(f.ctx, id, { present: false, durationMin: 50, coachIds: ['tm-virgil'] }));
    expect(f.state.lessons[0]).toMatchObject({ state: 'saved', present: false, price: null, amount: 0 });
    ok(await saveLesson(f.ctx, id, { present: true, durationMin: 60, coachIds: ['tm-virgil', 'tm-andreea'] }));
    expect(f.state.lessons[0]).toMatchObject({ present: true, price: 100, amount: 100, durationMin: 60 });
    setPrice(f, 'pl-club', 'Lecție individuală', { nonMemberPrice: 120 });
    ok(await saveLesson(f.ctx, id, { present: true, durationMin: 50, coachIds: ['tm-virgil', 'tm-andreea'] }));
    expect(f.state.lessons[0].price).toBe(100);
    expect(lessonLines(f).slice(1)).toEqual(['Lecție salvată: absent.', 'Lecție salvată: prezent.', 'Durată: "50 min" → "60 min"',
      'Antrenor: "Virgil Pascu" → "Virgil Pascu, Andreea Pascu"', 'Durată: "60 min" → "50 min"']);
    expect(ok(await saveLesson(f.ctx, id, { present: true, durationMin: 50, coachIds: ['tm-virgil', 'tm-andreea'] })).value).toMatchObject({ changed: false, toast: 'Nicio modificare.' });
  });
  it('the undo of a create is refused after a save (7.3)', async () => {
    const f = attendanceSeed();
    const r = ok(await createLesson(f.ctx, body()));
    ok(await saveLesson(f.ctx, r.value.lessonId, { present: true, durationMin: 50, coachIds: ['tm-virgil'] }));
    expect(await undoPresenceAction(f.ctx, { actionId: r.actionId })).toEqual({ ok: false, status: 409, error: 'Nu se mai poate anula. Datele s-au schimbat între timp.' });
  });
  it('delete with undo; a paid lesson is not deleted (C49, decided 13)', async () => {
    const f = attendanceSeed();
    const id = ok(await createLesson(f.ctx, body({ date: '2026-11-20' }))).value.lessonId;
    const before = { ...f.state.lessons[0] };
    const d = await deleteLesson(f.ctx, id);
    expect(ok(d).value).toEqual({ deleted: true, toast: 'Lecție ștearsă.' });
    ok(await undoPresenceAction(f.ctx, { actionId: ok(d).actionId }));
    const { id: _old, ...fields } = before;
    expect(f.state.lessons[0]).toMatchObject(fields);
    const back = f.state.lessons[0].id;
    f.state.payments.push(paymentRow({ id: 'p1', athleteId: 'a5', purpose: 'lectie', lessonId: back }));
    expect(await deleteLesson(f.ctx, back)).toEqual({ ok: false, status: 409, error: 'Datele s-au schimbat. Reîncarcă pagina.' });
    f.state.payments[0].cancelled = true;
    expect((await deleteLesson(f.ctx, back)).ok).toBe(true);
  });
  it('lists the month with states and reads the panel (5.2, 5.5)', async () => {
    const f = attendanceSeed();
    f.state.lessons.push(lessonRow({ id: 'l1', athleteId: 'a1', date: '2026-11-18', startTime: '18:00', state: 'planned' }),
      lessonRow({ id: 'l2', athleteId: 'a5', date: '2026-11-25', startTime: '09:00', state: 'planned' }),
      lessonRow({ id: 'l0', athleteId: 'a6', date: '2026-11-18', startTime: '10:00', state: 'saved', present: true, savedBy: 'Ana Admin', savedAt: '2026-11-18T09:00:00.000Z' }));
    expect(ok(await listLessons(f.store, '2026-11', '2026-11-20')).map((l) => [l.lessonId, l.state])).toEqual([['l0', 'salvata'], ['l1', 'nefacuta'], ['l2', 'urmeaza']]);
    expect(ok(await readLesson(f.store, 'l0'))).toMatchObject({ athleteName: 'Luca Marin', savedLine: 'Salvată de Ana Admin, 18 noi 2026 11:00', deletable: true });
    expect(ok(await newLessonDefaults(f.store, { athlete: 'a5', date: '2026-11-25' }))).toEqual({ coachIds: ['tm-andreea'] });
    expect(ok(await newLessonDefaults(f.store, { athlete: 'a9', date: '2026-11-25' }))).toEqual({ coachIds: [] });
  });
  it('refuses a bad lesson (5.5, decided 14)', async () => {
    const f = attendanceSeed();
    expect(await createLesson(f.ctx, body({ coachIds: [] }))).toEqual({ ok: false, status: 400, error: 'Alege antrenorul.' });
    for (const over of [{ durationMin: 52 }, { startTime: '18' }, { date: '2026-02-30' }, { athleteId: 'a9' }, { athleteId: 'nope' }, { coachIds: ['nope'] }])
      expect((await createLesson(f.ctx, body(over))).ok, JSON.stringify(over)).toBe(false);
    expect(f.state.lessons).toEqual([]);
  });
  it('locks the athlete, then the lesson (7.1)', async () => {
    const f = attendanceSeed();
    const id = ok(await createLesson(f.ctx, body())).value.lessonId;
    f.group.locks.length = 0;
    await saveLesson(f.ctx, id, { present: true, durationMin: 50, coachIds: ['tm-virgil'] });
    expect(f.group.locks).toEqual(['athlete:a5', `lesson:${id}`]);
  });
});

describe('the athlete is read again after the lock (final review M3)', () => {
  const merged = (f: ReturnType<typeof attendanceSeed>, id: string) => ({
    ...f.ctx,
    store: { ...f.ctx.store, lockLesson: async (lockId: string) => { await f.ctx.store.lockLesson(lockId); f.state.lessons.find((l) => l.id === id)!.athleteId = 'a-other'; } },
  });
  it('save and delete refuse 409 when the lesson moved to another athlete meanwhile', async () => {
    const fresh = () => attendanceSeed('2026-11-20', { lessons: [lessonRow({ id: 'l9', athleteId: 'a5' })] });
    const stale = { ok: false, status: 409, error: 'Datele s-au schimbat. Reîncarcă pagina.' };
    const [s, d] = [fresh(), fresh()];
    expect(await saveLesson(merged(s, 'l9'), 'l9', { present: true, durationMin: 50, coachIds: ['tm-virgil'] })).toEqual(stale);
    expect(await deleteLesson(merged(d, 'l9'), 'l9')).toEqual(stale);
    expect([s.state.lessons[0].state, d.state.lessons.length]).toEqual(['planned', 1]);
  });
});
