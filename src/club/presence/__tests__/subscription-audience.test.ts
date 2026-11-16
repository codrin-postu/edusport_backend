import { describe, expect, it } from 'vitest';
import { audienceOf, feeLine, itemPrice } from '../subscriptions/audience';

const item = { memberPrice: 320, nonMemberPrice: 360 };

describe('abonament audience', () => {
  it('the box picks the audience and its price', () => {
    expect(audienceOf(true)).toBe('member');
    expect(audienceOf(false)).toBe('neafiliat');
    expect(itemPrice(item, 'member')).toBe(320);
    expect(itemPrice(item, 'neafiliat')).toBe(360);
    expect(itemPrice({ memberPrice: null, nonMemberPrice: 360 }, 'member')).toBeNull();
  });

  it('the fee box only when membership turns on and the season has a fee', () => {
    expect(feeLine(true, false, 50)).toEqual({ show: true, label: 'Adaugă cotizația (50 lei)' });
    expect(feeLine(true, true, 50)).toBeNull();
    expect(feeLine(false, false, 50)).toBeNull();
    expect(feeLine(true, false, null)).toBeNull();
  });
});
