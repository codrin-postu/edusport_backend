import { describe, expect, it } from 'vitest';
import { normalizeSeasonLabel, seasonStartYear } from '../season';

describe('normalizeSeasonLabel', () => {
  it('accepts a hyphen', () => expect(normalizeSeasonLabel('2026-2027')).toBe('2026-2027'));
  it('turns an en dash into a hyphen', () => expect(normalizeSeasonLabel('2025–2026')).toBe('2025-2026'));
  it('trims spaces around the parts', () => expect(normalizeSeasonLabel(' 2025 - 2026 ')).toBe('2025-2026'));
  it('rejects years that are not consecutive', () => expect(normalizeSeasonLabel('2025-2027')).toBeNull());
  it('rejects empty, null and garbage', () => {
    expect(normalizeSeasonLabel('')).toBeNull();
    expect(normalizeSeasonLabel(null)).toBeNull();
    expect(normalizeSeasonLabel(undefined)).toBeNull();
    expect(normalizeSeasonLabel('sezonul trecut')).toBeNull();
  });
});

describe('seasonStartYear', () => {
  it('returns the first year', () => expect(seasonStartYear('2026-2027')).toBe(2026));
  it('throws on a non-normalized label', () => expect(() => seasonStartYear('2026')).toThrow());
});
