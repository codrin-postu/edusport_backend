'use strict';

const ANNOUNCEMENT = {
  title: 'Anunț important',
  message: 'Antrenamentele din această săptămână sunt suspendate din cauza condițiilor meteo.',
  isActive: false,
  type: 'warning',
};

async function seedAnnouncement() {
  console.log('\nSeeding announcement...');

  const existing = await strapi.documents('api::announcement.announcement').findFirst();

  if (existing) {
    await strapi.documents('api::announcement.announcement').update({
      documentId: existing.documentId,
      data: ANNOUNCEMENT,
    });
    console.log('   Updated existing announcement entry.');
  } else {
    await strapi.documents('api::announcement.announcement').create({ data: ANNOUNCEMENT });
    console.log('   Created announcement entry.');
  }
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  app.log.level = 'error';

  try {
    await seedAnnouncement();
    console.log('\nAnnouncement seed complete!\n');
  } catch (err) {
    console.error('\nSeed failed:', err);
    process.exit(1);
  }

  await app.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
