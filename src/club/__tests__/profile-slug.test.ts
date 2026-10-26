import { describe, expect, it } from 'vitest';
import { previousSlugOwner, previousSlugQuery, slugify, uniqueSlug } from '../profile-slug';

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

describe('a merged-away address (d39, plan 3-3 Task 6)', () => {
  it('reads filters[previousSlugs][$contains] and drops that filter', () => {
    expect(previousSlugQuery({ filters: { previousSlugs: { $contains: ' maria-pop-2 ' } }, populate: { photo: true } })).toEqual({
      slug: 'maria-pop-2', rest: { populate: { photo: true } },
    });
    expect(previousSlugQuery({ filters: { slug: { $eq: 'x' } } })).toBeNull();
    expect(previousSlugQuery({})).toBeNull();
  });

  it('finds the profile that remembers exactly that address', () => {
    const rows = [
      { documentId: 'a', previousSlugs: ['maria-pop-22'], showPublicPage: true },
      { documentId: 'b', previousSlugs: ['maria-pop-2'], showPublicPage: true },
      { documentId: 'c', previousSlugs: null, showPublicPage: true },
    ];
    expect(previousSlugOwner(rows, 'maria-pop-2')).toBe('b');
    expect(previousSlugOwner(rows, 'maria')).toBeNull();
  });

  it('never resolves an address of a profile whose page is off', () => {
    expect(previousSlugOwner([{ documentId: 'h', previousSlugs: ['ana-ion'], showPublicPage: false }], 'ana-ion')).toBeNull();
  });
});
