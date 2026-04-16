'use strict';

/**
 * Seed script — populates the homepage single type with default content.
 *
 * Usage:
 *   docker exec strapi_app node scripts/seed-homepage.js
 *   -- or --
 *   node scripts/seed-homepage.js   (when running locally)
 */

const DATA = {
  hero: {
    motto: 'Educație prin sport',
    ctaLabel: 'Descoperă Cursurile',
    ctaUrl: '/cursuri',
  },
  registration: {
    seasonLabel: 'Sezonul 2025–2026',
    heading: 'Sezonul a început!',
    body: 'Suntem bucuroși să anunțăm că înscrierile pentru noul sezon sunt deschise. Alătură-te școlii noastre de patinaj și descoperă bucuria gheții alături de antrenorii noștri cu experiență.',
    bodySecondary: 'Locurile sunt limitate. Înscrierea se face în ordinea solicitărilor.',
    scheduleDays: 'Sâmbătă & Duminică',
    scheduleTimes: '10:00–10:50 & 11:00–11:50',
    locationName: 'AFI Cotroceni',
    locationMapUrl: 'https://maps.google.com/?q=AFI+Cotroceni+Bucuresti',
    ctaPrimaryLabel: 'Înscrie-te',
    ctaPrimaryUrl: '/inscrieri',
    ctaSecondaryLabel: 'Află mai mult',
    ctaSecondaryUrl: '/cursuri',
    pricesLinkLabel: 'Vezi prețurile',
    pricesLinkUrl: '/inscrieri#preturi',
  },
  registrationClosed: {
    seasonLabel: 'Sezonul 2025–2026',
    heading: 'Ne vedem în următorul sezon!',
    body: 'Mulțumim tuturor cursanților și familiilor lor pentru un sezon minunat. Înscrierile pentru noul sezon vor fi disponibile în curând.\n\nPentru a fi primii care află când se deschid înscrierile, alăturați-vă canalului nostru de WhatsApp.',
    whatsappLabel: 'Alătură-te pe WhatsApp',
    whatsappUrl: '',
    contactLabel: 'Contactează-ne',
    contactUrl: '/contact',
  },
  about: {
    eyebrow: 'Cine suntem',
    heading: 'Asociație non-profit pentru sport și educație',
    body: 'ACS EduSport Reșița este o asociație sportivă non-profit înființată în 2012, cu misiunea de a contribui la dezvoltarea armonioasă a tineretului prin sport.\n\nOperăm cea mai mare Școală de Patinaj din București, cu aproximativ 150 de copii pe sezon, și sprijinim sportivii talentați în obținerea înaltei performanțe.',
    ctaLabel: 'Despre noi',
    ctaUrl: '/despre-noi/istoric',
  },
};

async function seedHomepage() {
  console.log('\n🏠  Seeding homepage…');
  const existing = await strapi.documents('api::homepage.homepage').findFirst();
  if (existing) {
    await strapi.documents('api::homepage.homepage').update({
      documentId: existing.documentId,
      data: DATA,
    });
    console.log('   ✅  Updated existing entry');
  } else {
    await strapi.documents('api::homepage.homepage').create({ data: DATA });
    console.log('   ✅  Created entry');
  }
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  app.log.level = 'error';

  try {
    await seedHomepage();
    console.log('\n✨  Homepage seed complete!\n');
  } catch (err) {
    console.error('\n❌  Seed failed:', err);
    process.exit(1);
  }

  await app.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
