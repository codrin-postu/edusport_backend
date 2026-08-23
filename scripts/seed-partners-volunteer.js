'use strict';

// Seeds the Parteneri + Voluntariat content: sponsors, collaboration events,
// and the volunteer-page single type. Text only — logos/photos are uploaded
// manually in the admin (media library). Idempotent: collections seed only
// when empty; the single type is created or updated.

const SPONSORS = [
  { name: 'EDEA', order: 1 },
  { name: 'Risport', order: 2 },
  { name: 'Jackson', order: 3 },
  { name: 'AFI Cotroceni', order: 4 },
  { name: 'Federația Română de Patinaj', order: 5 },
  { name: 'John Wilson', order: 6 },
  { name: 'Edea Skates', order: 7 },
  { name: 'Ice Space', order: 8 },
];

const EVENTS = [
  {
    title: 'Cupa de Iarnă',
    partner: 'AFI Cotroceni',
    date: 'Decembrie 2024',
    description: 'Competiție demonstrativă organizată împreună, cu peste 80 de participanți.',
    order: 1,
  },
  {
    title: 'Ziua Porților Deschise',
    partner: 'Partener local',
    date: 'Mai 2024',
    description: 'Sesiuni gratuite de patinaj pentru familii, susținute de partenerul nostru.',
    order: 2,
  },
];

const VOLUNTEER = {
  content: {
    heroTitle: 'Voluntariat',
    heroSubtitle:
      'Clubul crește cu oameni care dăruiesc timp. Dă o mână de ajutor și fii parte din comunitatea EduSport.',
    introEyebrow: 'De ce voluntariat',
    introHeading: 'Timpul tău face diferența',
    introBody:
      'Experiență reală lângă antrenori și sportivi, prieteni noi și un sport pe care îl duci mai departe în comunitate. Fără experiență prealabilă — te învățăm tot ce trebuie.',
  },
  helpWays: [
    { title: 'La competiții', desc: 'Culise și sprijin pentru sportivi în ziua concursului.' },
    { title: 'Organizare & logistică', desc: 'Pregătire materiale, transport și coordonare pe teren.' },
    { title: 'Cu cei mici', desc: 'Mentorat pentru începători la primii pași pe gheață.' },
    { title: 'Foto & promovare', desc: 'Fotografie, social media și povești din culise.' },
  ],
};

async function seedSponsors() {
  const existing = await strapi.documents('api::sponsor.sponsor').findMany({});
  if (existing && existing.length > 0) {
    console.log(`Sponsors: ${existing.length} already present, skipping.`);
    return;
  }
  for (const data of SPONSORS) {
    await strapi.documents('api::sponsor.sponsor').create({ data });
  }
  console.log(`Sponsors: created ${SPONSORS.length}.`);
}

async function seedEvents() {
  const existing = await strapi
    .documents('api::collaboration-event.collaboration-event')
    .findMany({});
  if (existing && existing.length > 0) {
    console.log(`Collaboration events: ${existing.length} already present, skipping.`);
    return;
  }
  for (const data of EVENTS) {
    await strapi.documents('api::collaboration-event.collaboration-event').create({ data });
  }
  console.log(`Collaboration events: created ${EVENTS.length}.`);
}

async function seedVolunteerPage() {
  const existing = await strapi.documents('api::volunteer-page.volunteer-page').findFirst();
  if (existing) {
    await strapi.documents('api::volunteer-page.volunteer-page').update({
      documentId: existing.documentId,
      data: VOLUNTEER,
    });
    console.log('Volunteer page: updated.');
  } else {
    await strapi.documents('api::volunteer-page.volunteer-page').create({ data: VOLUNTEER });
    console.log('Volunteer page: created.');
  }
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  app.log.level = 'error';

  try {
    await seedSponsors();
    await seedEvents();
    await seedVolunteerPage();
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }

  await app.destroy();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
