import { describe, expect, it } from 'vitest';
import type { CurrentSeason } from '../current-season';
import {
  buildPublicClubInfo,
  buildPublicSchools,
  resolveSubscriptionChoice,
  type PublicSchool,
} from '../public-info';

const TOOLTIP_6 = 'Disponibil pentru cei care știu că vor lipsi un weekend din cele 4 aferente abonamentului.';

const season: CurrentSeason = {
  documentId: 'season-doc',
  label: '2026-2027',
  startMonth: '2026-10-01',
  endMonth: '2027-05-31',
  membershipFee: 250,
};

// Rows shaped like Strapi documents, stuffed with fields that must never reach the public.
const school = {
  id: 3,
  documentId: 'sec-school',
  name: 'Școala de Patinaj - AFI Cotroceni',
  kind: 'school',
  slug: 'afi-cotroceni',
  order: 1,
  publicPage: true,
  registrationsOpen: true,
  priceNotes: ['Nota 1', '', 7, 'Nota 2'],
  location: { address: 'Bd. Vasile Milea' },
  createdAt: '2026-10-01T00:00:00.000Z',
};
// Club has a public page on purpose: it must still never appear.
const club = { id: 4, documentId: 'sec-club', name: 'Club', kind: 'club', slug: 'club', order: 0, publicPage: true, registrationsOpen: false, priceNotes: ['Notă club'] };
const hiddenSchool = { documentId: 'sec-hidden', name: 'Școală fără pagină', kind: 'school', slug: 'ascunsa', order: 3, publicPage: false, priceNotes: null };
const item = (over: Record<string, unknown>) => ({
  id: 11,
  name: 'Abonament 8 ședințe grup',
  kind: 'subscription',
  sessions: 8,
  memberPrice: 590,
  nonMemberPrice: 790,
  included: true,
  tooltip: null,
  ...over,
});
const standard = {
  id: 1,
  documentId: 'list-standard',
  name: 'Standard',
  section: { id: 3, documentId: 'sec-school' },
  items: [
    item({ name: 'Abonament 6 ședințe grup', sessions: 6, memberPrice: 520, nonMemberPrice: 720, tooltip: TOOLTIP_6 }),
    item({}),
    item({ name: '1 ședință grup', kind: 'session', sessions: null, memberPrice: null, nonMemberPrice: 150, tooltip: 'Disponibil doar pentru prima ședință' }),
    item({ name: 'Fără preț', memberPrice: null, nonMemberPrice: null }),
  ],
};
// Test value; the real Avansați Gold price is entered later in the Prețuri screen.
const gold = {
  documentId: 'list-gold',
  name: 'Avansați Gold',
  section: { documentId: 'sec-school' },
  items: [item({ name: 'Abonament Avansați Gold 8 ședințe', memberPrice: 600, nonMemberPrice: null })],
};
const noPrices = { documentId: 'list-empty', name: 'Fără prețuri', section: { documentId: 'sec-school' }, items: [item({ memberPrice: null, nonMemberPrice: null })] };
const otherSection = { documentId: 'list-other', name: 'Altă secțiune', section: { documentId: 'sec-hidden' }, items: [item({})] };
const clubList = { documentId: 'list-club', name: 'Club', section: { documentId: 'sec-club' }, items: [item({ name: 'Antrenament club' })] };

const schools = () => buildPublicSchools([club, school, hiddenSchool], [standard, gold, noPrices, otherSection, clubList]);

describe('buildPublicSchools', () => {
  it('builds the public view of each section with every list and its priced items', () => {
    expect(schools()).toEqual([
      {
        name: 'Școala de Patinaj - AFI Cotroceni',
        slug: 'afi-cotroceni',
        priceNotes: ['Nota 1', 'Nota 2'],
        priceLists: [
          {
            name: 'Standard',
            items: [
              { name: 'Abonament 6 ședințe grup', kind: 'subscription', sessions: 6, memberPrice: 520, nonMemberPrice: 720, tooltip: TOOLTIP_6 },
              { name: 'Abonament 8 ședințe grup', kind: 'subscription', sessions: 8, memberPrice: 590, nonMemberPrice: 790, tooltip: null },
              { name: '1 ședință grup', kind: 'session', sessions: null, memberPrice: null, nonMemberPrice: 150, tooltip: 'Disponibil doar pentru prima ședință' },
            ],
          },
          {
            name: 'Avansați Gold',
            items: [
              { name: 'Abonament Avansați Gold 8 ședințe', kind: 'subscription', sessions: 8, memberPrice: 600, nonMemberPrice: null, tooltip: null },
            ],
          },
        ],
      },
    ]);
  });

  it('never lists Club, even with a public page, nor a school without a public page', () => {
    expect(schools().map((x) => x.slug)).toEqual(['afi-cotroceni']);
    expect(JSON.stringify(schools())).not.toMatch(/Club|Antrenament club|Notă club|ascunsa/);
  });

  it('leaks no private field', () => {
    const json = JSON.stringify(buildPublicClubInfo(season, schools()));
    expect(json).not.toMatch(/documentId|"id"|included|createdAt|location|publicPage|registrationsOpen|season-doc|sec-school|list-|Altă secțiune/);
    const first = schools()[0];
    expect(Object.keys(first).sort()).toEqual(['name', 'priceLists', 'priceNotes', 'slug']);
    expect(Object.keys(first.priceLists[0]).sort()).toEqual(['items', 'name']);
    expect(Object.keys(first.priceLists[0].items[0]).sort()).toEqual(['kind', 'memberPrice', 'name', 'nonMemberPrice', 'sessions', 'tooltip']);
  });

  it('drops sections without a usable name, slug or documentId', () => {
    const base = { kind: 'school', publicPage: true };
    expect(
      buildPublicSchools([{ ...base, name: 'Fără slug', documentId: 'x' }, { ...base, slug: 'fara-nume', documentId: 'y' }, { ...base, name: 'Fără id', slug: 'fara-id' }], []),
    ).toEqual([]);
  });

  it('orders schools by their order field, then by name', () => {
    const two = { ...school, documentId: 'sec-two', name: 'Alta', slug: 'alta', order: 0 };
    expect(buildPublicSchools([school, two], []).map((x) => x.slug)).toEqual(['alta', 'afi-cotroceni']);
  });

  it('shows every list of the section; drops incomplete items and lists left empty', () => {
    expect(schools()[0].priceLists.map((l) => l.name)).toEqual(['Standard', 'Avansați Gold']);
    expect(JSON.stringify(schools())).not.toContain('Fără pre');
  });
});

describe('buildPublicClubInfo', () => {
  it('returns the season period and fee without internal ids', () => {
    const info = buildPublicClubInfo(season, []);
    expect(info).toEqual({ season: { label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31' }, membershipFee: 250, schools: [] });
  });

  it('still lists prices when there is no current season', () => {
    const info = buildPublicClubInfo(null, schools());
    expect(info.season).toBeNull();
    expect(info.membershipFee).toBeNull();
    expect(info.schools).toHaveLength(1);
  });
});

describe('resolveSubscriptionChoice', () => {
  const view: PublicSchool = schools()[0];

  it('freezes the member price for a member', () =>
    expect(resolveSubscriptionChoice(view, 'Abonament 8 ședințe grup', true)).toEqual({
      priceItemName: 'Abonament 8 ședințe grup',
      price: 590,
      member: true,
    }));

  it('freezes the non-member price for a non-member', () =>
    expect(resolveSubscriptionChoice(view, ' 1 ședință grup ', false)).toEqual({ priceItemName: '1 ședință grup', price: 150, member: false }));

  it('refuses an item not offered to members', () => expect(resolveSubscriptionChoice(view, '1 ședință grup', true)).toBeNull());

  it('offers the member-only Gold item to members only', () => {
    expect(resolveSubscriptionChoice(view, 'Abonament Avansați Gold 8 ședințe', true)).toEqual({
      priceItemName: 'Abonament Avansați Gold 8 ședințe',
      price: 600,
      member: true,
    });
    expect(resolveSubscriptionChoice(view, 'Abonament Avansați Gold 8 ședințe', false)).toBeNull();
  });

  it('refuses an unknown or incomplete item', () => {
    expect(resolveSubscriptionChoice(view, 'Abonament 99 ședințe', false)).toBeNull();
    expect(resolveSubscriptionChoice(view, 'Fără preț', false)).toBeNull();
  });
});
