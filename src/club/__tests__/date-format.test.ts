import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DATE_PLACEHOLDER, isoToSlash, maskSlash, numericDateToSlash, slashToIso } from '../date-format';

describe('date-format', () => {
  it('has the one placeholder', () => {
    expect(DATE_PLACEHOLDER).toBe('zz / ll / aaaa');
  });

  it('isoToSlash', () => {
    expect(isoToSlash('2018-12-01')).toBe('01/12/2018');
    expect(isoToSlash('2018-12-01T10:30')).toBe('01/12/2018');
    expect(isoToSlash('2018-02-30')).toBeNull();
    expect(isoToSlash('')).toBeNull();
  });

  it('slashToIso', () => {
    expect(slashToIso('01/12/2018')).toBe('2018-12-01');
    expect(slashToIso('31/04/2018')).toBeNull();
    expect(slashToIso('1/12/2018')).toBeNull();
    expect(slashToIso('29/02/2016')).toBe('2016-02-29');
    expect(slashToIso('29/02/2015')).toBeNull();
  });

  it('maskSlash', () => {
    expect(maskSlash('01122018')).toBe('01/12/2018');
    expect(maskSlash('0112')).toBe('01/12');
    expect(maskSlash('01/1')).toBe('01/1');
    expect(maskSlash('01')).toBe('01');
    expect(maskSlash('0a1b/2')).toBe('01/2');
    expect(maskSlash('011220189999')).toBe('01/12/2018');
    expect(maskSlash('')).toBe('');
  });

  it('numericDateToSlash changes whole-string numeric dates only', () => {
    expect(numericDateToSlash('24.07.2015')).toBe('24/07/2015');
    expect(numericDateToSlash('2018-12-01')).toBe('01/12/2018');
    expect(numericDateToSlash('24/07/2015')).toBe('24/07/2015');
    expect(numericDateToSlash('26 oct 2026')).toBe('26 oct 2026');
    expect(numericDateToSlash('')).toBe('');
    expect(numericDateToSlash('Trimis 24.07.2015')).toBe('Trimis 24.07.2015');
    expect(numericDateToSlash('31.02.2015')).toBe('31.02.2015');
  });
});

const read = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8');
const filesUnder = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const full = join(dir, n);
    return statSync(full).isDirectory() ? filesUnder(full) : /\.tsx?$/.test(n) ? [full] : [];
  });

describe('admin date sources', () => {
  it('DateInput types with the slash mask and shows the placeholder; its only type="date" is the hidden picker', () => {
    const src = read('src/admin/ui/DateInput.tsx');
    expect(src).toMatch(/import \{[^}]*\bDATE_PLACEHOLDER\b[^}]*\bmaskSlash\b|import \{[^}]*\bmaskSlash\b[^}]*\bDATE_PLACEHOLDER\b/);
    expect(src).toContain('inputMode="numeric"');
    const dateTypes = src.match(/type="date"/g) ?? [];
    expect(dateTypes).toHaveLength(1);
    expect(src).toMatch(/type="date"\s+className="ui-date-native"[\s\S]*aria-hidden="true"/);
    expect(src).not.toMatch(/datetime-local/);
  });

  it('DateRangeInput is built on DateInput, with no helper text of its own', () => {
    expect(read('src/admin/ui/DateRangeInput.tsx')).toContain("import { DateInput } from './DateInput'");
  });

  it('no dd.mm.yyyy display pattern remains in src/admin', () => {
    const offenders = filesUnder('src/admin').filter((f) => /dd\.mm\.yyyy|zz\.ll\.aaaa|ZZ\.LL\.AAAA/i.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
