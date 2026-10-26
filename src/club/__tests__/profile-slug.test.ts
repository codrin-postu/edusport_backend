import { describe, expect, it } from 'vitest';
import { slugify, uniqueSlug } from '../profile-slug';

describe('profile address (spec 6.3)', () => {
  it('makes a web address from the name', () => {
    expect(slugify('Ștefan Ionescu-Pop')).toBe('stefan-ionescu-pop');
    expect(slugify('  Ana  Maria ')).toBe('ana-maria');
  });

  it('never returns an empty address', () => expect(slugify(' ! ')).toBe('sportiv'));

  it('skips addresses already used, old merged addresses included', () => {
    expect(uniqueSlug('ana', new Set(['ana', 'ana-2']))).toBe('ana-3');
    expect(uniqueSlug('ion', new Set(['ana']))).toBe('ion');
  });
});
