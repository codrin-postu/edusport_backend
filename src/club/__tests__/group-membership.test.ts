import { describe, expect, it } from 'vitest';
import { checkMainGroup, countDistinctAthletes, setMainGroup } from '../group-membership';

const S = 'season-2026';

describe('checkMainGroup', () => {
  it('is ok with no lists at all', () => expect(checkMainGroup([], S)).toEqual({ ok: true }));
  it('is ok with exactly one main', () =>
    expect(
      checkMainGroup(
        [
          { groupId: 'g1', seasonId: S, isMain: true },
          { groupId: 'g2', seasonId: S, isMain: false },
        ],
        S,
      ),
    ).toEqual({ ok: true }));
  it('fails with lists but no main', () =>
    expect(checkMainGroup([{ groupId: 'g1', seasonId: S, isMain: false }], S)).toEqual({ ok: false, reason: 'none' }));
  it('fails with two mains', () =>
    expect(
      checkMainGroup(
        [
          { groupId: 'g1', seasonId: S, isMain: true },
          { groupId: 'g2', seasonId: S, isMain: true },
        ],
        S,
      ),
    ).toEqual({ ok: false, reason: 'many' }));
  it('only looks at the given season', () =>
    expect(
      checkMainGroup(
        [
          { groupId: 'g1', seasonId: S, isMain: true },
          { groupId: 'g1', seasonId: 'season-2025', isMain: true },
        ],
        S,
      ),
    ).toEqual({ ok: true }));
});

describe('setMainGroup', () => {
  it('moves the main flag within the season only', () => {
    const next = setMainGroup(
      [
        { groupId: 'g1', seasonId: S, isMain: true },
        { groupId: 'g2', seasonId: S, isMain: false },
        { groupId: 'g1', seasonId: 'season-2025', isMain: true },
      ],
      S,
      'g2',
    );
    expect(next).toEqual([
      { groupId: 'g1', seasonId: S, isMain: false },
      { groupId: 'g2', seasonId: S, isMain: true },
      { groupId: 'g1', seasonId: 'season-2025', isMain: true },
    ]);
  });
  it('throws when the athlete is not on that group', () =>
    expect(() => setMainGroup([{ groupId: 'g1', seasonId: S, isMain: true }], S, 'g9')).toThrow());
});

describe('countDistinctAthletes', () => {
  it('counts someone on two groups once', () =>
    expect(countDistinctAthletes([{ athleteId: 'a' }, { athleteId: 'a' }, { athleteId: 'b' }])).toBe(2));
});
