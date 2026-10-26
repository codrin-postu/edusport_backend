import { describe, expect, it } from 'vitest';
import { nameKey, normalizeGroupName, parsePrice } from '../migrate/names';

describe('normalizeGroupName', () => {
  it('replaces cedilla letters with comma-below letters', () =>
    expect(normalizeGroupName('Primii Paşi')).toBe('Primii Pași'));
  it('trims and collapses spaces', () => expect(normalizeGroupName('  Intermediari   Silver ')).toBe('Intermediari Silver'));
});

describe('nameKey', () => {
  it('ignores case and diacritics', () => {
    expect(nameKey('Profesioniști')).toBe(nameKey('profesionisti '));
    expect(nameKey('Primii Paşi')).toBe(nameKey('Primii Pași'));
  });
});

describe('parsePrice', () => {
  it('reads numbers out of text', () => {
    expect(parsePrice('890 RON')).toBe(890);
    expect(parsePrice('890,50 lei')).toBe(890.5);
    expect(parsePrice(270)).toBe(270);
  });
  it('null when there is no number', () => {
    expect(parsePrice('gratuit')).toBeNull();
    expect(parsePrice(undefined)).toBeNull();
  });
});
