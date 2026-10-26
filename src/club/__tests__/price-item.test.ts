import { describe, expect, it } from 'vitest';
import { asText, asTextList } from '../narrow';
import { duplicateItemNames, isIncomplete, isOfferedTo, isPrice, isPriceItemKind, offeredItems, priceFor } from '../price-item';

// Test values; the real Avansați Gold price is entered later in the Prețuri screen.
const sub6 = { name: 'Abonament 6 ședințe grup', memberPrice: 520, nonMemberPrice: 720 };
const single = { name: '1 ședință grup', memberPrice: null, nonMemberPrice: 150 };
const gold = { name: 'Abonament Avansați Gold 8 ședințe', memberPrice: 600, nonMemberPrice: null };
const empty = { name: 'Fără preț', memberPrice: null, nonMemberPrice: null };

describe('offeredItems', () => {
  it('offers each item to the audience it has a price for', () => {
    expect(offeredItems([sub6, single, gold, empty], 'member')).toEqual([sub6, gold]);
    expect(offeredItems([sub6, single, gold, empty], 'nonMember')).toEqual([sub6, single]);
  });

  it('isOfferedTo follows the same rule', () => {
    expect(isOfferedTo(single, 'member')).toBe(false);
    expect(isOfferedTo(gold, 'member')).toBe(true);
  });
});

describe('isIncomplete', () => {
  it('only when both prices are missing', () => {
    expect(isIncomplete(sub6)).toBe(false);
    expect(isIncomplete(single)).toBe(false);
    expect(isIncomplete(gold)).toBe(false);
    expect(isIncomplete(empty)).toBe(true);
    expect(isIncomplete({})).toBe(true);
  });
});

describe('prices', () => {
  it('zero is a price; negative, NaN, text and missing are not', () => {
    expect(isPrice(0)).toBe(true);
    expect(isPrice(590)).toBe(true);
    expect(isPrice(-1)).toBe(false);
    expect(isPrice(Number.NaN)).toBe(false);
    expect(isPrice('590')).toBe(false);
    expect(isPrice(null)).toBe(false);
    expect(isPrice(undefined)).toBe(false);
  });

  it('priceFor picks the audience price', () => {
    expect(priceFor(sub6, 'member')).toBe(520);
    expect(priceFor(sub6, 'nonMember')).toBe(720);
    expect(priceFor(single, 'member')).toBeNull();
  });

  it('knows the price item kinds', () => {
    expect(isPriceItemKind('subscription')).toBe(true);
    expect(isPriceItemKind('abonament')).toBe(false);
  });
});

describe('duplicateItemNames', () => {
  it("finds a name used in two of a school's lists, ignoring case, spaces and diacritics", () => {
    expect(
      duplicateItemNames([
        { items: [{ name: 'Abonament 8 ședințe grup' }, { name: '1 ședință grup' }] },
        { items: [{ name: ' abonament 8 sedinte GRUP' }] },
      ]),
    ).toEqual(['Abonament 8 ședințe grup']);
  });

  it('finds a name repeated inside one list', () => {
    expect(duplicateItemNames([{ items: [{ name: '1 ședință grup' }, { name: '1 ședință grup' }] }])).toEqual(['1 ședință grup']);
  });

  it('is empty when every name is unique or missing', () => {
    expect(duplicateItemNames([{ items: [{ name: 'A' }, { name: '' }, {}] }, { items: null }, {}])).toEqual([]);
  });
});

describe('narrow', () => {
  it('asText trims strings and empties the rest', () => {
    expect(asText('  Standard ')).toBe('Standard');
    expect(asText(7)).toBe('');
    expect(asText(null)).toBe('');
  });

  it('asTextList keeps non-empty strings only', () => {
    expect(asTextList([' a ', '', 3, null, 'b'])).toEqual(['a', 'b']);
    expect(asTextList('a')).toEqual([]);
    expect(asTextList(null)).toEqual([]);
  });
});
