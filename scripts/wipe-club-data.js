'use strict';

/**
 * Deletes all competition-results, competitions, and sportspeople so the
 * seed script can repopulate them from scratch.
 *
 * Usage:
 *   docker exec strapi_app node scripts/wipe-club-data.js
 */

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');
  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  app.log.level = 'error';

  try {
    const wipe = async (uid, label) => {
      const entries = await app.documents(uid).findMany({ pagination: { pageSize: 500 } });
      for (const e of entries) {
        await app.documents(uid).delete({ documentId: e.documentId });
      }
      console.log(`✅  Deleted ${entries.length} ${label}`);
    };

    await wipe('api::competition.competition', 'competitions');
    await wipe('api::sportsperson.sportsperson', 'sportspeople');

    console.log('\n✨  Wipe complete. Run seed:content to repopulate.\n');
  } catch (err) {
    console.error('\n❌  Wipe failed:', err);
    process.exit(1);
  }

  await app.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
