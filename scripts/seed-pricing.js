'use strict';

const TOOLTIP_6_SEDINTE = 'Disponibil pentru cei care știu că vor lipsi un weekend din cele 4 aferente abonamentului.';

const PRICING = {
  tiers: {
    memberTiers: [
      { label: 'Abonament 6 ședințe grup', price: '520 RON', tooltip: TOOLTIP_6_SEDINTE },
      { label: 'Abonament 8 ședințe grup', price: '590 RON' },
    ],
    nonMemberTiers: [
      { label: '1 ședință grup', price: '150 RON', note: 'Disponibil doar pentru prima ședință' },
      { label: 'Abonament 6 ședințe grup', price: '720 RON', tooltip: TOOLTIP_6_SEDINTE },
      { label: 'Abonament 8 ședințe grup', price: '790 RON' },
    ],
    memberFeeLabel: 'Taxa de membru (o dată/sezon)',
    memberFeePrice: '250 RON',
  },
  footerNotes: [
    'Taxa de membru se achită o singură dată pe sezon, la înscrierea la cursurile noastre, indiferent de momentul înscrierii, și este valabilă în perioada octombrie 2025 – mai 2026. Taxa nu este fracționară.',
    'Ne rezervăm dreptul de a modifica tarifele pe durata sezonului de cursuri (octombrie–mai). Modificările prețurilor vor fi anunțate cu 30 de zile calendaristice înainte de intrarea în vigoare a noilor prețuri.',
  ],
};

async function seedPricing() {
  console.log('Seeding pricing...');

  const existing = await strapi.documents('api::pricing.pricing').findFirst();

  if (existing) {
    await strapi.documents('api::pricing.pricing').update({
      documentId: existing.documentId,
      data: PRICING,
    });
    console.log('Pricing updated with full data.');
  } else {
    await strapi.documents('api::pricing.pricing').create({
      data: PRICING,
    });
    console.log('Pricing created.');
  }

  console.log(`Done: ${PRICING.tiers.memberTiers.length} member tiers, ${PRICING.tiers.nonMemberTiers.length} non-member tiers, ${PRICING.footerNotes.length} footer notes`);
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  app.log.level = 'error';

  try {
    await seedPricing();
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
