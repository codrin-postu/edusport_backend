import { describe, expect, it } from 'vitest';
import { quickSearchClause } from '../list-search';

describe('Înscrieri quick search', () => {
  it('matches the registration number as well as names, e-mail and phone', () => {
    expect(quickSearchClause(' 2026-0142 ')).toEqual({
      $or: [
        { childName: { $containsi: '2026-0142' } },
        { parentName: { $containsi: '2026-0142' } },
        { email: { $containsi: '2026-0142' } },
        { phone: { $containsi: '2026-0142' } },
        { registrationNumber: { $containsi: '2026-0142' } },
      ],
    });
  });

  it('adds no clause for an empty search', () => {
    expect(quickSearchClause('   ')).toBeNull();
  });
});
