'use strict';

// Migrate the legacy program.calendarEvents (day-level season calendar) into
// the new calendar-event model:
//   - one recurring "Școala de patinaj" event (weekends, that season), with
//     every non-Curs weekend recorded as a per-date Liber/Anulat exception.
//   - competitions / vacations / events become normal one-off calendar events.
// Idempotent: skips if a Școala event already exists.

const CAT = { concurs: 'concurs', vacation: 'vacanta', eveniment: 'eveniment', 'curs-special': 'eveniment' };

function pad(n) { return String(n).padStart(2, '0'); }
function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function eachDay(a, b, fn) { for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) fn(new Date(d)); }
function isWeekend(d) { const w = d.getDay(); return w === 0 || w === 6; }

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';
  const docs = (uid) => app.documents(uid);
  const EV = 'api::calendar-event.calendar-event';

  try {
    const existing = await docs(EV).findMany({ filters: { type: 'scoala' }, limit: 1 });
    if (existing.length) { console.log('Școala event already exists, skipping.'); await app.destroy(); process.exit(0); }

    const p = await docs('api::program.program').findFirst({});
    const ce = Array.isArray(p && p.calendarEvents) ? p.calendarEvents : [];
    const valid = ce.filter((e) => e && e.startDate && /^\d{4}-\d{2}-\d{2}$/.test(e.startDate) && e.type !== 'meta-default');

    const cursDates = new Set();
    const anulatDates = new Set();
    let min = null, max = null;
    for (const e of valid) {
      if (!['curs', 'liber', 'anulat'].includes(e.type)) continue;
      const s = new Date(e.startDate); const en = new Date(e.endDate || e.startDate);
      if (!min || s < min) min = s;
      if (!max || en > max) max = en;
      eachDay(s, en, (d) => {
        if (e.type === 'curs') cursDates.add(ymd(d));
        else if (e.type === 'anulat') anulatDates.add(ymd(d));
      });
    }

    if (min && max) {
      // Non-curs weekends within the season become Liber (or Anulat) exceptions.
      const exceptions = [];
      eachDay(min, max, (d) => {
        if (!isWeekend(d)) return;
        const key = ymd(d);
        if (cursDates.has(key)) return; // default Curs
        exceptions.push({ date: key, kind: anulatDates.has(key) ? 'anulat' : 'liber' });
      });

      await docs(EV).create({
        data: {
          title: 'Școala de patinaj',
          type: 'scoala',
          label: 'Școala',
          color: '#be3330',
          description: 'Cursuri de patinaj pentru începători. Sâmbăta și duminica, 10:00–10:50 și 11:00–11:50.',
          linkUrl: '/cursuri',
          linkLabel: 'Detalii',
          order: 0,
          recurrence: {
            freq: 'weekly',
            mon: false, tue: false, wed: false, thu: false, fri: false, sat: true, sun: true,
            startTime: '10:00:00.000', endTime: '11:50:00.000',
            seasonStart: ymd(min), seasonEnd: ymd(max),
          },
          exceptions,
        },
      });
      console.log(`Created Școala event: season ${ymd(min)}..${ymd(max)}, ${cursDates.size} curs days, ${exceptions.length} exceptions.`);
    }

    // One-off events for the non-Școala entries.
    let others = 0;
    for (const e of valid) {
      const cat = CAT[e.type];
      if (!cat) continue;
      await docs(EV).create({
        data: {
          title: e.title || (cat === 'concurs' ? 'Competiție' : cat === 'vacanta' ? 'Vacanță' : 'Eveniment'),
          type: cat,
          description: e.description || null,
          order: 0,
          recurrence: { freq: 'none', singleDate: e.startDate, endDate: e.endDate && e.endDate !== e.startDate ? e.endDate : null },
          exceptions: [],
        },
      });
      others += 1;
    }
    console.log(`Created ${others} one-off events (competiții / vacanțe / evenimente).`);
  } catch (e) {
    console.error('Migration failed:', e);
    process.exit(1);
  }

  await app.destroy();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
