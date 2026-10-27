import { describe, expect, it } from 'vitest';
import { G_GROUPS } from '../../groups/__tests__/fake-group-store';
import type { GroupRecord } from '../../groups/types';
import type { AcsRow } from '../../athletes/store';
import type { PriceItemRow, PriceListRecord } from '../types';
import { audienceFor, clubCharges, groupsWithoutPriceList, lessonPrice } from '../billing';

const item = (over: Partial<PriceItemRow> & Pick<PriceItemRow, 'name' | 'kind'>): PriceItemRow => ({
  sessions: null, memberPrice: null, nonMemberPrice: null, included: false, ...over,
});
const P_LISTS: PriceListRecord[] = [
  {
    id: 'pl-club', name: 'Club', sectionId: 'club', items: [
      item({ name: 'Ședință grup', kind: 'session', memberPrice: 40, nonMemberPrice: 50 }),
      item({ name: 'Uscat', kind: 'uscat', memberPrice: 20, nonMemberPrice: 25 }),
      item({ name: 'Lecție individuală', kind: 'individual', memberPrice: 80, nonMemberPrice: 100 }),
    ],
  },
  {
    id: 'pl-club-inclus', name: 'Club inclus', sectionId: 'club', items: [
      item({ name: 'Ședință grup', kind: 'session', memberPrice: 40, nonMemberPrice: 50 }),
      item({ name: 'Uscat', kind: 'uscat', memberPrice: 20, nonMemberPrice: 25, included: true }),
    ],
  },
];
const list = (id: string): PriceListRecord => {
  const found = P_LISTS.find((l) => l.id === id);
  if (!found) throw new Error(`no list ${id}`);
  return found;
};
const P_GROUPS: GroupRecord[] = G_GROUPS.map((g) => (g.id === 'g-av' ? { ...g, priceListId: 'pl-club' } : g));

const club = list('pl-club'); const inclus = list('pl-club-inclus');
describe('Club prices, audience, lesson price', () => {
  it('Grup and Uscat at member and non-member prices, both charged (4.12, C27, C28)', () => {
    expect(clubCharges(club, { grup: true, uscat: true }, 'member')).toEqual({ billing: 'club', amount: 60, charges: [
      { type: 'grup', itemName: 'Ședință grup', price: 40, included: false }, { type: 'uscat', itemName: 'Uscat', price: 20, included: false }] });
    expect(clubCharges(club, { grup: true, uscat: false }, 'nonMember')).toMatchObject({ billing: 'club', amount: 50 });
  });
  it('an included item is recorded and never billed (p5 Q17)', () => {
    expect(clubCharges(inclus, { grup: true, uscat: true }, 'member')).toMatchObject({ billing: 'club', amount: 40 });
    expect(clubCharges(inclus, { grup: false, uscat: true }, 'member')).toEqual({ billing: 'inclus', amount: 0,
      charges: [{ type: 'uscat', itemName: 'Uscat', price: 20, included: true }] });
  });
  it('no list, missing item, missing audience price (4.12, p5 Q15)', () => {
    expect(clubCharges(null, { grup: true, uscat: false }, 'member')).toEqual({ charges: [], billing: 'fara_pret', amount: 0 });
    const noUscat = { ...club, items: club.items.filter((i) => i.kind !== 'uscat') };
    expect(clubCharges(noUscat, { grup: false, uscat: true }, 'member')).toEqual({ billing: 'fara_pret', amount: 0,
      charges: [{ type: 'uscat', itemName: '', price: null, included: false }] });
    expect(clubCharges(noUscat, { grup: true, uscat: true }, 'member')).toMatchObject({ billing: 'club', amount: 40 });
    const noMember = { ...club, items: club.items.map((i) => ({ ...i, memberPrice: null })) };
    expect(clubCharges(noMember, { grup: true, uscat: false }, 'member')).toMatchObject({ billing: 'fara_pret', amount: 0 });
  });
  it('member price only with A.C.S. Da for that season (4.13)', () => {
    const acs = [{ id: 'x', athleteId: 'a1', seasonId: 's26', state: 'da' as const }, { id: 'y', athleteId: 'a2', seasonId: 's26', state: 'in_asteptare' as const }];
    expect([audienceFor(acs, 'a1', 's26'), audienceFor(acs, 'a2', 's26'), audienceFor(acs, 'a3', 's26'), audienceFor(acs, 'a1', 's25'), audienceFor(acs, 'a1', null)])
      .toEqual(['member', 'nonMember', 'nonMember', 'nonMember', 'nonMember']);
  });
  it('lesson price from the first individual item (5.5)', () => {
    expect(lessonPrice(club, 'nonMember')).toEqual({ itemName: 'Lecție individuală', price: 100 });
    expect(lessonPrice(inclus, 'member')).toEqual({ itemName: null, price: null });
    expect(lessonPrice(null, 'member')).toEqual({ itemName: null, price: null });
  });
  it('counts active groups without a price list (4.12)', () => {
    expect(groupsWithoutPriceList([...P_GROUPS, { ...P_GROUPS[0], id: 'g-x', active: false, priceListId: null }])).toBe(1); // g-pro
  });
});
