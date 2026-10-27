import { describe, expect, it } from 'vitest';
import type { PriceListRecord } from '../types';
import { P_GROUPS, P_LISTS } from './fake-store';
import { audienceFor, clubCharges, groupsWithoutPriceList, lessonPrice } from '../billing';

const list = (id: string): PriceListRecord => {
  const found = P_LISTS.find((l) => l.id === id);
  if (!found) throw new Error(`no list ${id}`);
  return found;
};

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
  it('inclus when nothing is billed and an item is included; fara_pret when nothing is ticked (decided 9)', () => {
    const noGrup = { ...inclus, items: inclus.items.filter((i) => i.kind === 'uscat') };
    expect(clubCharges(noGrup, { grup: true, uscat: true }, 'member')).toEqual({ billing: 'inclus', amount: 0, charges: [
      { type: 'grup', itemName: '', price: null, included: false }, { type: 'uscat', itemName: 'Uscat', price: 20, included: true }] });
    const allIncluded = { ...inclus, items: inclus.items.map((i) => ({ ...i, included: true })) };
    expect(clubCharges(allIncluded, { grup: true, uscat: true }, 'member')).toMatchObject({ billing: 'inclus', amount: 0 });
    expect(clubCharges(club, { grup: false, uscat: false }, 'member')).toEqual({ charges: [], billing: 'fara_pret', amount: 0 });
  });
  it('a price of 0 is billed: club with amount 0; sums in whole bani (12.5 + 7.3 = 19.8)', () => {
    const free = { ...club, items: club.items.map((i) => ({ ...i, memberPrice: 0 })) };
    expect(clubCharges(free, { grup: true, uscat: false }, 'member')).toEqual({ billing: 'club', amount: 0,
      charges: [{ type: 'grup', itemName: 'Ședință grup', price: 0, included: false }] });
    const rounded = { ...club, items: [{ ...club.items[0], memberPrice: 12.5 }, { ...club.items[1], memberPrice: 7.3 }] };
    expect(clubCharges(rounded, { grup: true, uscat: true }, 'member')).toMatchObject({ billing: 'club', amount: 19.8 });
  });
  it('counts active groups without a price list (4.12)', () => {
    expect(groupsWithoutPriceList([...P_GROUPS, { ...P_GROUPS[0], id: 'g-x', active: false, priceListId: null }])).toBe(1); // g-pro
  });
});
