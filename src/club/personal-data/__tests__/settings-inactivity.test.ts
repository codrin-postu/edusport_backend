import { describe, expect, it } from 'vitest';
import { inactiveAthleteIds, lastActiveYears, seasonStartYear, type InactivityInput } from '../inactivity';
import { DEFAULT_RETENTION_YEARS, hiddenUntil, readPersonalDataSettings, retentionYearsOf, reviewNoticeShown } from '../settings';

describe('settings reader (spec 2)', () => {
  it('defaults to 5 years and no hidden review', () => {
    expect(DEFAULT_RETENTION_YEARS).toBe(5);
    expect(readPersonalDataSettings(null)).toEqual({ retentionYears: 5, reviewHiddenUntilSeason: null });
    expect(readPersonalDataSettings({})).toEqual({ retentionYears: 5, reviewHiddenUntilSeason: null });
    expect(readPersonalDataSettings([3])).toEqual({ retentionYears: 5, reviewHiddenUntilSeason: null });
  });

  it('keeps 1 to 20, clamps outside, reads anything else as 5', () => {
    expect(retentionYearsOf(7)).toBe(7);
    expect(retentionYearsOf(1)).toBe(1);
    expect(retentionYearsOf(20)).toBe(20);
    expect(retentionYearsOf(0)).toBe(1);
    expect(retentionYearsOf(25)).toBe(20);
    expect(retentionYearsOf(2.5)).toBe(5);
    expect(retentionYearsOf('7')).toBe(5);
  });

  it('reads and writes the season the review is hidden for', () => {
    const s = readPersonalDataSettings({ retentionYears: 6, reviewHiddenUntilSeason: '2026-2027' });
    expect(s).toEqual({ retentionYears: 6, reviewHiddenUntilSeason: '2026-2027' });
    expect(readPersonalDataSettings({ reviewHiddenUntilSeason: '' }).reviewHiddenUntilSeason).toBeNull();
    expect(hiddenUntil({ retentionYears: 5, reviewHiddenUntilSeason: null }, '2027-2028')).toEqual({ retentionYears: 5, reviewHiddenUntilSeason: '2027-2028' });
  });

  it('shows the notice while the count is not zero and the review is not hidden this season', () => {
    const open = { retentionYears: 5, reviewHiddenUntilSeason: null };
    const hidden = { retentionYears: 5, reviewHiddenUntilSeason: '2026-2027' };
    expect(reviewNoticeShown(open, 3, '2026-2027')).toBe(true);
    expect(reviewNoticeShown(open, 0, '2026-2027')).toBe(false);
    expect(reviewNoticeShown(hidden, 3, '2026-2027')).toBe(false);
    expect(reviewNoticeShown(hidden, 3, '2027-2028')).toBe(true);
    expect(reviewNoticeShown(hidden, 3, null)).toBe(true);
  });
});

const SEASONS = [
  { id: 's19', label: '2019-2020', isCurrent: false },
  { id: 's20', label: '2020-2021', isCurrent: false },
  { id: 's21', label: '2021-2022', isCurrent: false },
  { id: 's22', label: '2022-2023', isCurrent: false },
  { id: 's25', label: '2025-2026', isCurrent: false },
  { id: 's26', label: '2026-2027', isCurrent: true },
  { id: 'sx', label: 'toamna', isCurrent: false },
];
const NOW = new Date('2026-10-27T09:00:00.000Z');
const RECENT = '2026-09-01T10:00:00.000Z';
const athlete = (id: string, over: Partial<{ status: string; createdAt: string }> = {}) => ({ id, status: 'activ', createdAt: RECENT, ...over });
const input = (over: Partial<InactivityInput>): InactivityInput => ({ athletes: [], memberships: [], registrations: [], seasons: SEASONS, retentionYears: 5, now: NOW, ...over });
const member = (athleteId: string, seasonId: string) => ({ athleteId, seasonId });
const reg = (athleteId: string | null, seasonId: string | null, season: string | null = null) => ({ athleteId, seasonId, season });

describe('inactivity rule (spec 5)', () => {
  it('reads the start year of a season label', () => {
    expect(seasonStartYear('2026-2027')).toBe(2026);
    expect(seasonStartYear('2026/2027')).toBe(2026);
    expect(seasonStartYear('toamna')).toBeNull();
    expect(seasonStartYear(null)).toBeNull();
  });

  it('the last active season is the latest of group seasons and linked registration seasons', () => {
    const years = lastActiveYears({
      seasons: SEASONS,
      memberships: [member('a', 's19'), member('b', 's21')],
      registrations: [reg('a', 's22'), reg('b', null, '2020-2021'), reg(null, 's26')],
    });
    expect(years).toEqual(new Map([['a', 2022], ['b', 2021]]));
  });

  it('qualifies at exactly N seasons before the current one, not at N - 1', () => {
    const ids = inactiveAthleteIds(input({
      athletes: [athlete('five'), athlete('four')],
      memberships: [member('five', 's21'), member('four', 's22')],
    }));
    expect([...ids]).toEqual(['five']);
  });

  it('a registration season counts like a group season; the latest activity wins', () => {
    const ids = inactiveAthleteIds(input({
      athletes: [athlete('regOnly'), athlete('textSeason'), athlete('later')],
      registrations: [reg('regOnly', 's20'), reg('textSeason', null, '2021-2022'), reg('later', 's25')],
      memberships: [member('later', 's19')],
    }));
    expect([...ids].sort()).toEqual(['regOnly', 'textSeason']);
  });

  it('no activity: the record must be at least N years old', () => {
    const ids = inactiveAthleteIds(input({
      athletes: [athlete('old', { createdAt: '2021-10-27T09:00:00.000Z' }), athlete('young', { createdAt: '2021-10-28T09:00:00.000Z' }), athlete('new')],
    }));
    expect([...ids]).toEqual(['old']);
  });

  it('a season label without a year is no activity', () => {
    const ids = inactiveAthleteIds(input({ athletes: [athlete('x', { createdAt: RECENT })], registrations: [reg('x', 'sx')] }));
    expect(ids.size).toBe(0);
  });

  it('never lists an anonymized athlete; no current season lists nobody', () => {
    expect(inactiveAthleteIds(input({ athletes: [athlete('anon', { status: 'anonimizat' })], memberships: [member('anon', 's19')] })).size).toBe(0);
    const noCurrent = SEASONS.map((s) => ({ ...s, isCurrent: false }));
    expect(inactiveAthleteIds(input({ seasons: noCurrent, athletes: [athlete('a')], memberships: [member('a', 's19')] })).size).toBe(0);
  });

  it('follows the retention setting', () => {
    const one = inactiveAthleteIds(input({ retentionYears: 1, athletes: [athlete('a')], memberships: [member('a', 's25')] }));
    expect([...one]).toEqual(['a']);
  });
});
