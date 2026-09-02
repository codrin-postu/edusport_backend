'use strict';

/**
 * Seed script - populates the homepage single type with default content.
 *
 * Usage:
 *   docker exec strapi_app node scripts/seed-homepage.js
 *   -- or --
 *   node scripts/seed-homepage.js   (when running locally)
 */

const DATA = {
  // Copy that used to be hardcoded in the frontend components.
  sections: {
    athletes: {
      heading: 'Sportivii noștri',
      intro:
        'Sportivi care se antrenează săptămânal la EduSport, de la primii pași pe gheață până la podiumuri naționale.',
      countLabel: 'sportivi legitimați',
      ctaLabel: 'Vezi toți sportivii',
      ctaUrl: '/despre-noi/sportivi',
    },
    stats: [
      { value: '10+', label: 'ani de experiență' },
      { value: '150', label: 'sportivi antrenați' },
      { value: '500+', label: 'ore pe gheață' },
      { value: '13+', label: 'competiții' },
    ],
  },
  hero: {
    ctaLabel: 'Descoperă Cursurile',
    ctaUrl: '/cursuri',
  },
  registration: {
    heading: 'Sezonul a început!',
    body: 'Suntem bucuroși să anunțăm că înscrierile pentru noul sezon sunt deschise. Alătură-te școlii noastre de patinaj și descoperă bucuria gheții alături de antrenorii noștri cu experiență.',
    bodySecondary: 'Locurile sunt limitate. Înscrierea se face în ordinea solicitărilor.',
    scheduleDays: 'Sâmbătă & Duminică',
    scheduleTimes: '10:00–10:50 & 11:00–11:50',
    locationName: 'AFI Cotroceni',
    ctaPrimaryLabel: 'Înscrie-te',
    ctaPrimaryUrl: '/inscrieri',
    ctaSecondaryLabel: 'Află mai mult',
    ctaSecondaryUrl: '/cursuri',
    pricesLinkLabel: 'Vezi prețurile',
    pricesLinkUrl: '/inscrieri#preturi',
  },
  registrationClosed: {
    heading: 'Ne vedem în următorul sezon!',
    body: 'Mulțumim tuturor cursanților și familiilor lor pentru un sezon minunat. Înscrierile pentru noul sezon vor fi disponibile în curând.\n\nPentru a fi primii care află când se deschid înscrierile, alăturați-vă canalului nostru de WhatsApp.',
    whatsappLabel: 'Alătură-te pe WhatsApp',
    whatsappUrl: '',
    contactLabel: 'Contactează-ne',
    contactUrl: '/contact',
  },
  about: {
    panels: [
      {
        eyebrow: 'Cine suntem',
        heading: 'Asociație non-profit\npentru sport și educație',
        body: 'Fondată în 2012, EduSport este o asociație non-profit dedicată dezvoltării sportive și educative a tinerilor - de la primii pași pe gheață până la podiumuri naționale.',
        ctaLabel: 'Despre noi',
        ctaUrl: '/despre-noi',
      },
      {
        eyebrow: 'Echipa noastră',
        heading: 'Antrenori dedicați,\ncursanți motivați',
        body: 'Patru antrenori certificați FRPA, fiecare cu o poveste proprie pe gheață. Împreună ghidează peste 50 de cursanți în 6 grupe.',
        ctaLabel: 'Cunoaște echipa',
        ctaUrl: '/despre-noi/echipa',
      },
      {
        eyebrow: 'Realizările noastre',
        heading: '32 de medalii\nși tot înainte',
        body: 'De la primul campionat național la competiții internaționale, cursanții EduSport au urcat pe podium de 32 de ori în 8 ani.',
        ctaLabel: 'Vezi realizările',
        ctaUrl: '/despre-noi/realizari',
      },
    ],
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
