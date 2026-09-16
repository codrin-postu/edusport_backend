'use strict';

/**
 * Seeds the scheduled-announcement collection.
 *
 * Five rows spanning every state the admin page groups by, so both the Anunțuri
 * screen and the site can be exercised without hand-typing dates:
 *
 *   live card      the real announcement that existed as the old single type,
 *                  carried over verbatim (message + CTA) so nothing was lost
 *                  when the single type became a collection
 *   live modal     a second live one, lower priority, to prove /current picks
 *                  the highest-priority winner and not just the first row
 *   paused         inside its window but isActive = false
 *   scheduled      starts next week
 *   ended          window closed last month
 *
 * Destructive by design: it wipes the collection first, so re-running it always
 * yields exactly these five.
 */

const UID = 'api::announcement.announcement';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const at = (days) => new Date(now + days * DAY).toISOString();

const ANNOUNCEMENTS = [
  {
    // Carried over from the single-type row (documentId dhp7fb8ba8rvlzcpl9j0ql7d).
    title: 'Cursuri suspendate',
    slug: 'cursuri-suspendate',
    eyebrow: 'Program',
    message:
      'Cursurile din saptamana (10-17 mai) nu vor fi tinute datorita unor modificari din programa scoalara. Puteti vedea calendarul complet pe pagina de program.',
    format: 'card',
    ctaLabel: 'Program Cursuri',
    ctaUrl: '/cursuri/program',
    startAt: at(-2),
    endAt: at(11),
    priority: 1,
    isActive: true,
    dismissDays: 7,
  },
  {
    title: 'Înscrieri sezonul de iarnă',
    slug: 'inscrieri-sezon-iarna',
    eyebrow: 'Înscrieri',
    message:
      'Locurile pentru grupele de începători se ocupă rapid. Rezervă-ți locul completând formularul de înscriere.',
    format: 'modal',
    ctaLabel: 'Vreau un loc',
    ctaUrl: '/inscrieri',
    startAt: at(-5),
    endAt: at(20),
    priority: 5,
    isActive: true,
    dismissDays: 14,
  },
  {
    title: 'Spectacol de final de an',
    slug: 'spectacol-final-an',
    eyebrow: 'Eveniment',
    message:
      'Pregătim spectacolul de final de an. Detaliile despre bilete și program urmează în curând.',
    format: 'card',
    ctaLabel: '',
    ctaUrl: '',
    startAt: at(-3),
    endAt: at(30),
    priority: 10,
    isActive: false,
    dismissDays: 7,
  },
  {
    title: 'Cupa EduSport Reșița',
    slug: 'cupa-edusport-resita',
    eyebrow: 'Competiție',
    message:
      'Cupa EduSport Reșița are loc luna viitoare la patinoarul olimpic. Înscrierile se deschid odată cu publicarea regulamentului.',
    format: 'card',
    ctaLabel: 'Vezi competițiile',
    ctaUrl: '/realizari',
    startAt: at(7),
    endAt: at(40),
    priority: 20,
    isActive: true,
    dismissDays: 7,
  },
  {
    title: 'Tabăra de vară',
    slug: 'tabara-de-vara',
    eyebrow: 'Arhivă',
    message:
      'Tabăra de vară s-a încheiat. Mulțumim celor peste 60 de copii care au patinat alături de noi.',
    format: 'card',
    ctaLabel: 'Galerie foto',
    ctaUrl: '/istoric',
    startAt: at(-60),
    endAt: at(-30),
    priority: 100,
    isActive: true,
    dismissDays: 7,
  },
];

async function seedAnnouncements() {
  console.log('\nSeeding announcements...');

  const existing = await strapi.documents(UID).findMany({ fields: ['slug'], limit: -1 });
  for (const row of existing ?? []) {
    await strapi.documents(UID).delete({ documentId: row.documentId });
  }
  console.log(`   Removed ${existing?.length ?? 0} existing announcement(s).`);

  for (const data of ANNOUNCEMENTS) {
    await strapi.documents(UID).create({ data });
    console.log(`   Created "${data.title}" (${data.slug}).`);
  }
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  app.log.level = 'error';

  try {
    await seedAnnouncements();
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
