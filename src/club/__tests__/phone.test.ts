import { describe, expect, it } from 'vitest';
import { PHONE_ERROR, formatPhone, normalizePhone, whatsappDigits } from '../phone';

describe('normalizePhone', () => {
  it.each(['0722123456', '0722 123 456', '0722-123-456', '+40 722 123 456', '0040722123456'])('reads %s as a Romanian number', (raw) => {
    expect(normalizePhone(raw)).toBe('+40722123456');
  });

  it('keeps a foreign number', () => {
    expect(normalizePhone('+44 20 7946 0958')).toBe('+442079460958');
  });

  it.each(['12345', 'abc', '+40 12', ''])('refuses %s', (raw) => {
    expect(normalizePhone(raw)).toBeNull();
  });
});

describe('formatPhone', () => {
  it('spaces a valid number', () => {
    expect(formatPhone('0722123456')).toEqual({ text: '+40 722 123 456', valid: true });
  });

  it('returns an invalid number as typed', () => {
    expect(formatPhone('0722 12')).toEqual({ text: '0722 12', valid: false });
  });
});

describe('whatsappDigits', () => {
  it('gives E.164 without the plus', () => {
    expect(whatsappDigits('0722123456')).toBe('40722123456');
  });

  it('gives null for an invalid number', () => {
    expect(whatsappDigits('12345')).toBeNull();
  });
});

describe('PHONE_ERROR', () => {
  it('is the shared message', () => {
    expect(PHONE_ERROR).toBe('Numărul de telefon nu este valid.');
  });
});
