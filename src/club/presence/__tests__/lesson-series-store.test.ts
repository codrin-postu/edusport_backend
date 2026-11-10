import { describe, expect, it, vi } from 'vitest';
import { athleteRow, fakeClubStore } from '../../athletes/__tests__/fake-store';
import { mergeAthletes } from '../../athletes/merge';
import { removePresenceRows } from '../lifecycle/delete-guard';
import { guardOf, recordPresenceAction } from '../action-log';
import { undoPresenceAction } from '../undo-service';
import { strapiPresenceStore, toLessonRow, toLessonSeriesRow } from '../strapi-store';
import type { Core } from '@strapi/strapi';
import { fakePresenceContext, fakePresenceStore, lessonRow, lessonSeriesRow } from './fake-store';
import { lessonOf, seriesRule, walkExpected, walkSeries } from './lesson-series-scenario';

const A = { group: { athletes: [athleteRow({ id: 'a1' })] } };

describe('lesson series in the fake store', () => {
  it('walks create, read by athlete (by from), update to, link and unlink lessons, delete', async () => {
    const f = fakePresenceStore(A);
    expect(await walkSeries(f.store, 'a1', 'tm-andreea')).toEqual(walkExpected('a1', 'tm-andreea'));
  });

  it('a lesson written with seriesId reads it back, an old lesson reads null', async () => {
    const f = fakePresenceStore({ ...A, lessons: [lessonRow({ id: 'old' })] });
    const sid = await f.store.createLessonSeries(seriesRule('a1', 'tm-andreea'));
    const id = await f.store.createLesson(lessonOf('a1', 'tm-andreea', '2026-11-10', sid));
    expect((await f.store.lesson(id))?.seriesId).toBe(sid);
    expect((await f.store.lesson('old'))?.seriesId).toBeNull();
    expect((await f.store.lessons({ seriesId: sid })).map((l) => l.id)).toEqual([id]);
  });

  it('the undo of a series create deletes its lessons, then the series', async () => {
    const f = fakePresenceContext(A);
    const actionId = await f.store.transaction(async () => {
      const sid = await f.store.createLessonSeries(seriesRule('a1', 'tm-andreea'));
      const ids = [await f.store.createLesson(lessonOf('a1', 'tm-andreea', '2026-11-10', sid)), await f.store.createLesson(lessonOf('a1', 'tm-andreea', '2026-11-12', sid))];
      return recordPresenceAction(f.store, 'admin@example.com', [{ subjectType: 'athlete', subjectId: 'a1', action: 'lesson-series-added' }], {
        athletes: ['a1'], guards: [await guardOf(f.store, 'lesson', ids[0]), await guardOf(f.store, 'lesson', ids[1])],
        steps: [...ids.map((id) => ({ op: 'deleteLesson' as const, id })), { op: 'deleteLessonSeries' as const, id: sid }],
      });
    });
    expect(f.state.lessonSeries).toHaveLength(1);
    expect(await undoPresenceAction(f.ctx, { actionId })).toEqual({ ok: true, data: { undone: true } });
    expect([f.state.lessons.length, f.state.lessonSeries.length]).toEqual([0, 0]);
  });

  it('the undo of a series delete recreates the rule and relinks the lessons it put back, and a series end is put back', async () => {
    const f = fakePresenceContext({ ...A, lessonSeries: [lessonSeriesRow({ id: 'ls1', to: '2026-11-11' })], lessons: [lessonRow({ id: 'l1', seriesId: 'ls1', date: '2026-11-10' })] });
    const first = f.state.lessons[0];
    const { id: _id, ...write } = first;
    const { id: _sid, ...rule } = f.state.lessonSeries[0];
    const actionId = await f.store.transaction(async () => {
      await f.store.deleteLesson('l1');
      await f.store.deleteLessonSeries('ls1');
      return recordPresenceAction(f.store, 'admin@example.com', [{ subjectType: 'athlete', subjectId: 'a1', action: 'lesson-series-ended' }], {
        athletes: ['a1'], guards: [], steps: [{ op: 'createLessonSeries', row: { ...rule, to: '2026-12-03' }, lessonIds: ['l1'] }, { op: 'createLesson', row: { ...write, seriesId: null }, was: 'l1' }],
      });
    });
    expect((await undoPresenceAction(f.ctx, { actionId })).ok).toBe(true);
    const [series] = f.state.lessonSeries;
    expect(series).toMatchObject({ athleteId: 'a1', to: '2026-12-03' });
    expect(f.state.lessons.map((l) => [l.date, l.seriesId])).toEqual([['2026-11-10', series.id]]);
    const g = fakePresenceContext({ ...A, lessonSeries: [lessonSeriesRow({ id: 'ls1', to: '2026-11-23' })] });
    const end = await g.store.transaction(async () => {
      await g.store.updateLessonSeries('ls1', { to: '2026-11-09' });
      return recordPresenceAction(g.store, 'admin@example.com', [{ subjectType: 'athlete', subjectId: 'a1', action: 'lesson-series-ended' }], {
        athletes: ['a1'], guards: [], steps: [{ op: 'setLessonSeries', id: 'ls1', to: '2026-11-23' }],
      });
    });
    expect((await undoPresenceAction(g.ctx, { actionId: end })).ok).toBe(true);
    expect(g.state.lessonSeries[0].to).toBe('2026-11-23');
    expect(g.group.locks).toContain('lessonSeries:ls1');
  });

  it('a merge moves both a lesson and its series to the kept athlete, locking the series before the lessons', async () => {
    const club = fakeClubStore({ athletes: [athleteRow({ id: 'k', name: 'Maria Pop' }), athleteRow({ id: 'r', name: 'Pop Maria' })] });
    const pres = fakePresenceStore({ lessonSeries: [lessonSeriesRow({ id: 'lsr', athleteId: 'r' })], lessons: [lessonRow({ id: 'lr', athleteId: 'r', seriesId: 'lsr' })] });
    const ctx = { store: club.store, actor: 'ana@club.ro', today: { year: 2026, month: 10, day: 27 }, log: vi.fn() };
    expect((await mergeAthletes(ctx, { keptId: 'k', removedId: 'r', take: [] }, pres.store)).ok).toBe(true);
    expect(pres.state.lessonSeries.map((s) => s.athleteId)).toEqual(['k']);
    expect(pres.state.lessons.map((l) => [l.athleteId, l.seriesId])).toEqual([['k', 'lsr']]);
    expect(pres.group.locks.filter((l) => l.startsWith('lesson'))).toEqual(['lessonSeries:lsr', 'lesson:lr']);
  });

  it('removePresenceRows leaves no series row, after the lessons', async () => {
    const f = fakePresenceStore({ lessonSeries: [lessonSeriesRow({ id: 'ls1' }), lessonSeriesRow({ id: 'ls2', athleteId: 'a2' })], lessons: [lessonRow({ id: 'l1', seriesId: 'ls1' })] });
    await f.store.transaction(() => removePresenceRows(f.store, 'a1'));
    expect(f.state.lessonSeries.map((s) => s.id)).toEqual(['ls2']);
    expect(f.state.lessons).toEqual([]);
  });
});

describe('lesson series on the Strapi store', () => {
  it('maps a row, reading days, times and the series link', () => {
    expect(toLessonSeriesRow({
      documentId: 'ls1', athlete: { documentId: 'a1' }, coaches: [{ documentId: 'tm-andreea' }], freq: 'monthly', days: ['wed', 'x'], weekOfMonth: 'second', startTime: '17:30:00.000',
      durationMin: 45, from: '2026-11-01', to: '2027-01-31', createdByName: 'Ana',
    })).toEqual({ id: 'ls1', athleteId: 'a1', coachIds: ['tm-andreea'], freq: 'monthly', days: ['wed'], weekOfMonth: 'second', startTime: '17:30', durationMin: 45, from: '2026-11-01', to: '2027-01-31', createdByName: 'Ana' });
    expect(toLessonRow({ documentId: 'l1', series: { documentId: 'ls1' } }).seriesId).toBe('ls1');
    expect(toLessonRow({ documentId: 'l2' }).seriesId).toBeNull();
  });

  it('queries lessons by series and series by athlete, locks the series table, writes relations by name', async () => {
    const seen: { uid: string; where: unknown; populate?: unknown }[] = [];
    const created: unknown[] = [];
    const strapi = {
      db: {
        query: (uid: string) => ({ findMany: async (a: { where: unknown; populate?: unknown }) => { seen.push({ uid, ...a }); return []; } }),
        getConnection: (t: string) => { const q = { transacting: () => q, forUpdate: () => q, where: (c: string, id: string) => { created.push(`${t} ${c}=${id}`); return q; }, select: async () => [] }; return q; },
        transaction: async (work: (a: { trx: string }) => Promise<unknown>) => work({ trx: 'trx' }),
      },
      documents: () => ({ create: async (a: { data: unknown }) => { created.push(a.data); return { documentId: 'x' }; } }),
    } as unknown as Core.Strapi;
    const store = strapiPresenceStore(strapi);
    await store.lessons({ seriesId: 's1' });
    await store.lessonSeriesOf('a1');
    await store.transaction(() => store.lockLessonSeries('s1'));
    await store.createLessonSeries(seriesRule('a1', 'tm-andreea'));
    await store.createLesson(lessonOf('a1', 'tm-andreea', '2026-11-10', 's1'));
    expect(seen[0]).toMatchObject({ uid: 'api::individual-lesson.individual-lesson', where: { series: { documentId: 's1' } } });
    expect(seen[0].populate).toContain('series');
    expect(seen[1]).toMatchObject({ uid: 'api::lesson-series.lesson-series', where: { athlete: { documentId: 'a1' } } });
    expect(created[0]).toBe('club_lesson_series document_id=s1');
    expect(created[1]).toMatchObject({ athlete: 'a1', coaches: ['tm-andreea'], from: '2026-11-10', to: '2026-12-03' });
    expect(created[2]).toMatchObject({ series: 's1' });
  });
});
