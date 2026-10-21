import { describe, expect, it } from 'vitest';
import { pickCurrentSeason } from '../current-season';

const row = (over: Record<string, unknown>) => ({
  documentId: 'season-2026',
  label: '2026-2027',
  startMonth: '2026-10-01',
  endMonth: '2027-05-31',
  membershipFee: 250,
  isCurrent: true,
  createdAt: '2026-10-19T08:00:00.000Z',
  ...over,
});

describe('pickCurrentSeason', () => {
  it('returns the season marked current, with only the fields callers need', () => {
    expect(pickCurrentSeason([row({ documentId: 'season-2025', label: '2025-2026', isCurrent: false }), row({})])).toEqual({
      documentId: 'season-2026',
      label: '2026-2027',
      startMonth: '2026-10-01',
      endMonth: '2027-05-31',
      membershipFee: 250,
    });
  });

  it('returns null when no season is current', () => {
    expect(pickCurrentSeason([])).toBeNull();
    expect(pickCurrentSeason([row({ isCurrent: false })])).toBeNull();
    expect(pickCurrentSeason([row({ isCurrent: null })])).toBeNull();
  });

  it('takes the latest label when several are marked current', () => {
    const picked = pickCurrentSeason([row({ label: '2026-2027' }), row({ documentId: 'season-2027', label: '2027-2028' })]);
    expect(picked?.label).toBe('2027-2028');
  });

  it('skips malformed rows instead of using them', () => {
    expect(pickCurrentSeason([row({ label: '2026–2027' })])).toBeNull();
    expect(pickCurrentSeason([row({ startMonth: null })])).toBeNull();
    expect(pickCurrentSeason([row({ documentId: undefined })])).toBeNull();
  });

  it('a missing fee is null, not zero', () => {
    expect(pickCurrentSeason([row({ membershipFee: null })])?.membershipFee).toBeNull();
  });
});
