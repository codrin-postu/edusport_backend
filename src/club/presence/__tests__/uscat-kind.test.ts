import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KIND_LABELS } from '../../../admin/pages/preturi/format';
import { PRICE_ITEM_KINDS } from '../../price-item';
import { toPublicItem } from '../../public-info';

const json = (path: string) => JSON.parse(readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8'));

describe('price item kind uscat (3.6)', () => {
  it('is a price item kind, in the component schema too', () => {
    expect(PRICE_ITEM_KINDS).toEqual(['subscription', 'session', 'individual', 'uscat']);
    expect(json('components/club/price-item.json').attributes.kind.enum).toEqual(['subscription', 'session', 'individual', 'uscat']);
  });

  it('Prețuri labels it "Uscat" (C10)', () => {
    expect(KIND_LABELS.uscat).toBe('Uscat');
  });

  it('public price reads leave uscat out (C11)', () => {
    expect(toPublicItem({ name: 'Uscat', kind: 'uscat', memberPrice: 20, nonMemberPrice: 25 })).toBeNull();
    expect(toPublicItem({ name: 'Ședință grup', kind: 'session', memberPrice: 40, nonMemberPrice: 50 })?.kind).toBe('session');
  });
});
