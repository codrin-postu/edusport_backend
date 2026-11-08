import { createRequire } from 'node:module';
import type { Core } from '@strapi/strapi';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readPresenceHistory } from '../history/read';
import { strapiPresenceStore } from '../strapi-store';

/**
 * Runs only with PRESENCE_PG_TEST=1 and DATABASE_* pointing at a throwaway Postgres 16 (never a shared database): it boots Strapi,
 * which creates the schema, then reads the real history pages. It pins the nested order by the session, the limit and the relation count.
 */
const { compileStrapi, createStrapi } = createRequire(__filename)('@strapi/strapi') as typeof import('@strapi/strapi');
const enabled = process.env.PRESENCE_PG_TEST === '1';

describe.skipIf(!enabled)('athlete presence history on Postgres', () => {
  let strapi: Core.Strapi;
  let athleteId = '';
  let seasonId = '';
  beforeAll(async () => {
    strapi = await createStrapi(await compileStrapi()).load();
    seasonId = (await strapi.documents('api::season.season').create({ data: { label: '2031-2032', startMonth: '2031-09-01', endMonth: '2032-08-31' } as never })).documentId;
    const group = await strapi.documents('api::group.group').create({ data: { name: 'Grupa history PG' } as never });
    athleteId = (await strapi.documents('api::athlete.athlete').create({ data: { name: 'Sportiv history PG', status: 'activ' } as never })).documentId;
    let n = 0;
    const attend = async (date: string, startTime: string): Promise<void> => {
      n += 1;
      const session = await strapi.documents('api::session.session').create({
        data: { group: group.documentId, season: seasonId, date, startTime, durationMin: 60, source: 'added', occurrenceKey: `history-pg-${n}` } as never,
      });
      await strapi.documents('api::attendance.attendance').create({
        data: { session: session.documentId, athlete: athleteId, billing: 'fara_abonament', uniqueKey: `history-pg-k${n}` } as never,
      });
    };
    const lesson = (date: string, startTime: string) =>
      strapi.documents('api::individual-lesson.individual-lesson').create({
        data: { athlete: athleteId, date, startTime, durationMin: 50, state: 'saved', present: true, amount: 150 } as never,
      });
    // 9 newer rows (8 sessions, 1 lesson), then three rows at the same date and time across the page boundary, then 2 older ones: 14 in all.
    for (let day = 14; day >= 7; day -= 1) await attend(`2031-10-${String(day).padStart(2, '0')}`, '17:00');
    await lesson('2031-10-06', '16:00');
    await attend('2031-10-05', '17:00');
    await attend('2031-10-05', '17:00');
    await lesson('2031-10-05', '17:00');
    await attend('2031-10-04', '17:00');
    await lesson('2031-10-03', '09:00');
  }, 240_000);
  afterAll(async () => {
    await strapi?.db.connection.destroy();
  });

  /** The expected order straight from SQL: date, start time, document id, all descending, over both sources. */
  const expected = async (): Promise<string[]> => {
    const rows = await strapi.db.connection.raw(`
      select ref from (
        select s.document_id as ref, s.date, s.start_time, a.document_id as id
          from club_attendances a
          join club_attendances_session_lnk l on l.attendance_id = a.id
          join club_sessions s on s.id = l.session_id
         where s.date between '2031-09-01' and '2032-08-31'
        union all
        select document_id, date, start_time, document_id from club_individual_lessons where present = true and date between '2031-09-01' and '2032-08-31'
      ) t order by date desc, start_time desc, id desc`);
    return (rows.rows as { ref: string }[]).map((r) => r.ref);
  };
  const page = async (n: number) => {
    const r = await readPresenceHistory(strapiPresenceStore(strapi), athleteId, seasonId, n);
    if (!r.ok) throw new Error('refused');
    return r.data;
  };

  it('14 rows: page 1 has 10, page 2 has 4, the total is 14 on both, in the SQL order with the tie split across the pages', async () => {
    const [p1, p2, order] = [await page(1), await page(2), await expected()];
    expect([p1.rows.length, p2.rows.length, p1.total, p2.total]).toEqual([10, 4, 14, 14]);
    expect(order).toHaveLength(14);
    const got = [...p1.rows, ...p2.rows].map((r) => r.sessionId ?? r.lessonId);
    expect(got).toEqual(order);
    expect(new Set(got).size).toBe(14);
  });

  it('a page past the last one answers with no rows and the same total', async () => {
    const p3 = await page(3);
    expect([p3.rows.length, p3.total]).toEqual([0, 14]);
  });
});
