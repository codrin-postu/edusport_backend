import { describe, expect, it } from 'vitest';
import {
  SEASON_ERRORS,
  formatPeriod,
  monthOf,
  monthOptions,
  nextSeasonDraft,
  readSeasonInput,
  seasonChanges,
  seasonWriteData,
  toAdminSeason,
} from '../season-admin';

const fields = { label: '2026-2027', startMonth: '2026-10', endMonth: '2027-05', membershipFee: 270 };

describe('readSeasonInput', () => {
  it('accepts a season with consecutive years, a period and a fee', () => {
    expect(readSeasonInput({ ...fields, label: ' 2026-2027 ' })).toEqual({ ok: true, season: fields });
    expect(readSeasonInput({ ...fields, membershipFee: null })).toEqual({ ok: true, season: { ...fields, membershipFee: null } });
  });

  it('refuses a label that is not YYYY-YYYY with consecutive years', () => {
    for (const label of ['2026', '2026–2027', '2026-2028', '26-27', '']) {
      expect(readSeasonInput({ ...fields, label })).toEqual({ ok: false, error: SEASON_ERRORS.label });
    }
  });

  it('refuses missing months, an end before the start and a negative fee', () => {
    expect(readSeasonInput({ ...fields, endMonth: '2027-13' })).toEqual({ ok: false, error: SEASON_ERRORS.months });
    expect(readSeasonInput({ ...fields, endMonth: '2026-10' })).toEqual({ ok: false, error: SEASON_ERRORS.order });
    expect(readSeasonInput({ ...fields, membershipFee: -5 })).toEqual({ ok: false, error: SEASON_ERRORS.fee });
    expect(readSeasonInput({ ...fields, membershipFee: '270' })).toEqual({ ok: false, error: SEASON_ERRORS.fee });
  });
});

describe('months', () => {
  it('reads the month of a stored date and formats the period', () => {
    expect(monthOf('2026-10-04')).toBe('2026-10');
    expect(monthOf(null)).toBe('');
    expect(formatPeriod('2026-10', '2027-05')).toBe('Octombrie 2026 - Mai 2027');
  });

  it("offers every month of the season's two years", () => {
    const options = monthOptions('2026-2027', ['2026-10', '2027-05']);
    expect(options).toHaveLength(24);
    expect(options[9]).toEqual({ value: '2026-10', label: 'Octombrie 2026' });
    expect(options[23]).toEqual({ value: '2027-12', label: 'Decembrie 2027' });
  });

  it('keeps a selected month outside those years, and falls back to this year for a bad label', () => {
    expect(monthOptions('2026-2027', ['2025-09']).map((o) => o.value)).toContain('2025-09');
    expect(monthOptions('abc', [], new Date('2030-03-01'))[0].value).toBe('2030-01');
  });
});

describe('seasonWriteData', () => {
  it('a new season starts on the 1st and ends on the last day of its months', () => {
    expect(seasonWriteData({ ...fields, endMonth: '2028-02' , label: '2027-2028', startMonth: '2027-10' }, null)).toEqual({
      label: '2027-2028',
      startMonth: '2027-10-01',
      endMonth: '2028-02-29',
      membershipFee: 270,
    });
  });

  it('keeps the stored date of a month the admin did not change', () => {
    const stored = { startMonth: '2026-10-04', endMonth: '2027-05-31' };
    expect(seasonWriteData({ ...fields, endMonth: '2027-06' }, stored)).toMatchObject({ startMonth: '2026-10-04', endMonth: '2027-06-30' });
  });
});

describe('seasonChanges and toAdminSeason', () => {
  it('records old -> new for the edited fields only', () => {
    expect(seasonChanges(fields, { ...fields, membershipFee: 300 })).toEqual({ membershipFee: { from: 270, to: 300 } });
  });

  it('builds a table row from a stored season', () => {
    const raw = { documentId: 'd1', label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', membershipFee: 270, isCurrent: true };
    expect(toAdminSeason(raw, 12)).toEqual({ ...fields, documentId: 'd1', isCurrent: true, registrations: 12 });
    expect(toAdminSeason({ label: 'x' }, 0)).toBeNull();
  });
});

describe('nextSeasonDraft', () => {
  it('is the newest season one year later, with its fee', () => {
    expect(nextSeasonDraft([{ ...fields, label: '2025-2026', startMonth: '2025-10', endMonth: '2026-05' }, fields])).toEqual({
      label: '2027-2028',
      startMonth: '2027-10',
      endMonth: '2028-05',
      membershipFee: 270,
    });
  });

  it('without seasons, October to May from this year', () => {
    expect(nextSeasonDraft([], new Date('2026-11-02'))).toEqual({ label: '2026-2027', startMonth: '2026-10', endMonth: '2027-05', membershipFee: null });
  });
});
