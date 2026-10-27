import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GROUP_TOASTS, athletesText, groupsText, sourceLine } from '../copy';

const DIR = join(__dirname, '..', 'copy');

describe('phase 4 copy (spec 11)', () => {
  it('has no em dash, no middle dot, no curly quotes and no cedilla letters in any copy file', () => {
    for (const file of readdirSync(DIR)) {
      const text = readFileSync(join(DIR, file), 'utf8');
      expect(text, file).not.toMatch(/[—·“”„şţŞŢ]/);
    }
  });

  it('uses the Romanian number forms', () => {
    expect(athletesText(1)).toBe('1 sportiv');
    expect(athletesText(20)).toBe('20 de sportivi');
    expect(groupsText(1)).toBe('1 grupă');
    expect(GROUP_TOASTS.allocatedAll(1)).toBe('1 sportiv alocat în grupa propusă.');
    expect(GROUP_TOASTS.allocatedAll(3)).toBe('3 sportivi alocați în grupele propuse.');
    expect(GROUP_TOASTS.added(20)).toBe('20 de sportivi adăugați în grupă.');
  });

  it('writes the "Fără grupă" source line, the age left out when unknown (5.3, W30)', () => {
    expect(sourceLine('registration', null, 12)).toBe('Înscriere Școală, 12 ani');
    expect(sourceLine('previous', '2026-2027', 1)).toBe('Din 2026-2027, 1 an');
    expect(sourceLine('added', null, null)).toBe('Adăugat în Sportivi');
  });

  it('keeps the gender-neutral toasts (W1)', () => {
    expect(GROUP_TOASTS.allocated('Intermediari Bronze', 'Elisa Georgescu')).toBe('Sportiv alocat în Intermediari Bronze: Elisa Georgescu.');
    expect(GROUP_TOASTS.moved('Intermediari Silver', 'Ana Ionescu')).toBe('Sportiv mutat în Intermediari Silver: Ana Ionescu.');
  });
});
