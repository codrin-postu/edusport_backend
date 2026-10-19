import { describe, expect, it } from 'vitest';
import { carryOverAcs, effectiveAcs, usesMemberPrice } from '../acs';

describe('carryOverAcs', () => {
  it('turns last season "da" into "in_asteptare" and drops the rest', () => {
    expect(
      carryOverAcs([
        { athleteId: 'a', state: 'da' },
        { athleteId: 'b', state: 'nu' },
        { athleteId: 'c', state: 'in_asteptare' },
      ]),
    ).toEqual([{ athleteId: 'a', state: 'in_asteptare' }]);
  });
});

describe('effectiveAcs', () => {
  it('shows "nu" when there is no value for the season', () => {
    expect(effectiveAcs(undefined)).toBe('nu');
    expect(effectiveAcs(null)).toBe('nu');
  });
  it('keeps a stored value', () => expect(effectiveAcs('in_asteptare')).toBe('in_asteptare'));
});

describe('usesMemberPrice', () => {
  it('only for "da"', () => {
    expect(usesMemberPrice('da')).toBe(true);
    expect(usesMemberPrice('in_asteptare')).toBe(false);
    expect(usesMemberPrice('nu')).toBe(false);
    expect(usesMemberPrice(undefined)).toBe(false);
  });
});
