'use strict';

// Sample calendar data to exercise the expansion endpoint: one weekly event
// (Grupa A, Mon+Wed 16:00-17:00) with a cancel + an override exception, plus a
// blackout range. Idempotent-ish: only seeds when there are no calendar events.

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');
  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  app.log.level = 'error';

  try {
    const existing = await app.documents('api::calendar-event.calendar-event').findMany({ limit: 1 });
    if (existing.length > 0) {
      console.log('Calendar events already exist — skipping sample seed.');
    } else {
      await app.documents('api::calendar-event.calendar-event').create({
        data: {
          title: 'Grupa A',
          type: 'curs',
          label: 'Grupa A',
          color: '#2138b8',
          order: 1,
          recurrence: {
            freq: 'weekly',
            mon: true, tue: false, wed: true, thu: false, fri: false, sat: false, sun: false,
            startTime: '16:00:00.000',
            endTime: '17:00:00.000',
            seasonStart: '2026-01-01',
            seasonEnd: '2026-05-31',
          },
          exceptions: [
            { date: '2026-01-07', kind: 'cancel' },
            { date: '2026-01-12', kind: 'override', newStartTime: '18:00:00.000', newEndTime: '19:00:00.000', newTitle: 'Grupa A (reprogramat)' },
          ],
        },
      });
      await app.documents('api::calendar-blackout.calendar-blackout').create({
        data: { label: 'Vacanța de iarnă', startDate: '2026-01-14', endDate: '2026-01-16' },
      });
      console.log('Seeded sample: 1 event (Grupa A) + 1 blackout.');
    }
  } catch (e) {
    console.error('Seed failed:', e);
    process.exit(1);
  }

  await app.destroy();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
