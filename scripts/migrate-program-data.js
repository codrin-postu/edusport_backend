'use strict';

// One-time copy of serii orar (scheduleGroups) + calendar sezonal
// (calendarEvents) from the old program-page single type into the new
// program single type. Idempotent: re-running just overwrites with the source.

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';

  try {
    const src = await app.documents('api::program-page.program-page').findFirst({});
    if (!src) {
      console.log('No program-page found, nothing to migrate.');
    } else {
      const data = {
        scheduleGroups: src.scheduleGroups ?? null,
        calendarEvents: src.calendarEvents ?? null,
      };
      const existing = await app.documents('api::program.program').findFirst({});
      if (existing) {
        await app.documents('api::program.program').update({ documentId: existing.documentId, data });
      } else {
        await app.documents('api::program.program').create({ data });
      }
      const sg = Array.isArray(data.scheduleGroups) ? data.scheduleGroups.length : 0;
      const ce = Array.isArray(data.calendarEvents) ? data.calendarEvents.length : 0;
      console.log(`Migrated to program: ${sg} serii orar, ${ce} calendar sezonal entries.`);
    }
  } catch (e) {
    console.error('Migration failed:', e);
    process.exit(1);
  }

  await app.destroy();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
