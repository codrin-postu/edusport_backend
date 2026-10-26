import { describe, expect, it } from 'vitest';
import { membershipFrom, registrationSeason, seasonEndedText, seasonRunning } from '../season';

const S25 = { id: 's25', label: '2025-2026', startMonth: '2025-10-01', endMonth: '2026-05-31' };
const S26 = { id: 's26', label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31' };
const d = (year: number, month: number, day: number) => ({ year, month, day });

describe("the registration's season (spec 4.3, gaps #31)", () => {
  it('uses the Sezon link, else the season text', () => {
    expect(registrationSeason({ seasonId: 's25', season: '2026-2027' }, [S25, S26])).toBe(S25);
    expect(registrationSeason({ seasonId: null, season: '2026–2027' }, [S25, S26])).toBe(S26);
  });

  it('is none when nothing matches (treated as ended)', () => {
    expect(registrationSeason({ seasonId: null, season: 'vara' }, [S25, S26])).toBeNull();
    expect(seasonRunning(null, d(2026, 10, 26))).toBe(false);
  });
});

describe('running up to the end month (r3 c9)', () => {
  it('runs through the whole end month, also before the start', () => {
    expect(seasonRunning(S26, d(2027, 5, 31))).toBe(true);
    expect(seasonRunning(S26, d(2027, 6, 1))).toBe(false);
    expect(seasonRunning(S26, d(2026, 9, 1))).toBe(true);
  });

  it('says it ended', () => {
    expect(seasonEndedText('2026-2027')).toBe('Sezonul 2026-2027 s-a încheiat. Se leagă doar fișa sportivului.');
  });
});

describe('membership start (gaps #29)', () => {
  it('is the confirmation date, or the season start when confirmed before it', () => {
    expect(membershipFrom(S26, d(2026, 10, 26))).toBe('2026-10-26');
    expect(membershipFrom(S26, d(2026, 9, 15))).toBe('2026-10-01');
  });
});
