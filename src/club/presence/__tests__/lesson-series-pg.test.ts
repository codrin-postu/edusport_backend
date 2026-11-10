import { createRequire } from 'node:module';
import type { Core } from '@strapi/strapi';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { strapiPresenceStore } from '../strapi-store';
import { fakePresenceStore } from './fake-store';
import { athleteRow } from '../../groups/__tests__/fake-group-store';
import { deleteLessonsFrom } from '../lessons/delete';
import { createLessonSeries } from '../lessons/series';
import { undoPresenceAction } from '../undo-service';
import type { PresenceContext } from '../context';
import { lessonOf, walkExpected, walkSeries } from './lesson-series-scenario';

/**
 * Runs only with PRESENCE_PG_TEST=1 and DATABASE_* pointing at a throwaway Postgres 16 (never a shared database), as history-pg.test.ts does:
 * it boots Strapi, which creates `club_lesson_series` and the `series` link, then walks the same store calls as the fake and expects the same answers.
 */
const { compileStrapi, createStrapi } = createRequire(__filename)('@strapi/strapi') as typeof import('@strapi/strapi');
const enabled = process.env.PRESENCE_PG_TEST === '1';

describe.skipIf(!enabled)('lesson series on Postgres', () => {
  let strapi: Core.Strapi;
  let athleteId = '';
  let coachId = '';
  let raceAthlete = '';
  beforeAll(async () => {
    strapi = await createStrapi(await compileStrapi()).load();
    athleteId = (await strapi.documents('api::athlete.athlete').create({ data: { name: 'Sportiv series PG', status: 'activ' } as never })).documentId;
    coachId = (await strapi.documents('api::team-member.team-member').create({ data: { name: 'Antrenor series PG' } as never })).documentId;
  }, 240_000);
  afterAll(async () => {
    await strapi?.db.connection.destroy();
  });

  it('answers what the fake store answers', async () => {
    const fake = fakePresenceStore({ group: { athletes: [athleteRow({ id: 'a1' })] } });
    expect(await walkSeries(fake.store, 'a1', 'tm-andreea')).toEqual(walkExpected('a1', 'tm-andreea'));
    expect(await walkSeries(strapiPresenceStore(strapi), athleteId, coachId)).toEqual(walkExpected(athleteId, coachId));
  });

  it('keeps the lesson when its series is deleted, and the row lock is taken inside a transaction', async () => {
    const store = strapiPresenceStore(strapi);
    const id = await store.createLessonSeries({
      athleteId, coachIds: [coachId], freq: 'biweekly', days: ['tue'], weekOfMonth: null, startTime: '10:00', durationMin: 30, from: '2026-11-10', to: '2026-12-08', createdByName: 'Ana',
    });
    await store.transaction(() => store.lockLessonSeries(id));
    expect((await store.lessonSeries(id))?.freq).toBe('biweekly');
    const lessonId = await store.createLesson(lessonOf(athleteId, coachId, '2026-11-10', id));
    expect((await store.lesson(lessonId))?.seriesId).toBe(id);
    await store.deleteLessonSeries(id);
    expect(await store.lessonSeries(id)).toBeNull();
    expect((await store.lesson(lessonId))?.seriesId).toBeNull();
  });

  it('two series for the same athlete and dates at once: one is written, the other answers 409 and leaves nothing', async () => {
    const seasons = strapi.documents('api::season.season');
    if (!(await seasons.findFirst({ filters: { label: '2026-2027' } }))) await seasons.create({ data: { label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31' } as never });
    const athlete = (await strapi.documents('api::athlete.athlete').create({ data: { name: 'Sportiv race PG', status: 'activ' } as never })).documentId;
    const ctx: PresenceContext = {
      store: strapiPresenceStore(strapi), actor: 'race@example.com', today: '2026-11-10', now: () => new Date('2026-11-10T10:00:00.000Z'), log: () => undefined, paymentEmails: () => undefined,
    };
    const body = { athleteId: athlete, date: '2026-11-10', startTime: '17:30', durationMin: 45, coachIds: [coachId], repeat: { freq: 'weekly' as const, days: ['tue' as const, 'thu' as const], until: '2026-12-03' } };
    const results = await Promise.all([createLessonSeries(ctx, body), createLessonSeries({ ...ctx, store: strapiPresenceStore(strapi) }, body)]);
    expect(results.map((r) => (r.ok ? 200 : r.status)).sort()).toEqual([200, 409]);
    expect(await ctx.store.lessons({ athleteId: athlete })).toHaveLength(8);
    expect(await ctx.store.lessonSeriesOf(athlete)).toHaveLength(1);
    raceAthlete = athlete;
  });

  it('delete following cuts the series on Postgres (planCut reads by series and ids) and the undo puts it back', async () => {
    const ctx: PresenceContext = {
      store: strapiPresenceStore(strapi), actor: 'cut@example.com', today: '2026-11-10', now: () => new Date('2026-11-10T10:00:00.000Z'), log: () => undefined, paymentEmails: () => undefined,
    };
    const rows = (await ctx.store.lessons({ athleteId: raceAthlete })).sort((a, b) => a.date.localeCompare(b.date));
    const cut = await deleteLessonsFrom(ctx, rows[2].id, coachId);
    expect(cut).toMatchObject({ ok: true, data: { value: { count: 6 } } });
    expect(await ctx.store.lessons({ athleteId: raceAthlete })).toHaveLength(2);
    const [series] = await ctx.store.lessonSeriesOf(raceAthlete);
    expect(series.to).toBe('2026-11-16');
    const actionId = cut.ok ? cut.data.actionId : null;
    expect((await undoPresenceAction(ctx, { actionId })).ok).toBe(true);
    expect(await ctx.store.lessons({ athleteId: raceAthlete })).toHaveLength(8);
    expect((await ctx.store.lessonSeriesOf(raceAthlete))[0].to).toBe('2026-12-03');
  });
});
