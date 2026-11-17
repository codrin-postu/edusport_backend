import { describe, expect, it } from 'vitest';
import { shortSchoolName } from '../inscrieri-school';
import { ALL_SCHOOLS, schoolTabs } from '../inscrieri-panel';

describe('shortSchoolName', () => {
  it('strips the "Școala de Patinaj - " prefix, also with other hyphens', () => {
    expect(shortSchoolName('Școala de Patinaj - AFI Cotroceni')).toBe('AFI Cotroceni');
    expect(shortSchoolName('Școala de Patinaj – Patinoar Nord')).toBe('Patinoar Nord');
    expect(shortSchoolName('Școala de Patinaj-Nord')).toBe('Nord');
  });

  it('keeps names without the prefix, and never returns an empty name', () => {
    expect(shortSchoolName('AFI')).toBe('AFI');
    expect(shortSchoolName('Școala de Patinaj - ')).toBe('Școala de Patinaj -');
    expect(shortSchoolName(null)).toBe('');
  });

  it('shortens the school tabs but not the "Toate" tab', () => {
    const meta = { schools: [{ documentId: 'a', name: 'Școala de Patinaj - AFI', count: 3 }], multipleSchools: true, allSchoolsTotal: 3 };
    expect(schoolTabs(meta).map((t) => t.label)).toEqual(['Toate', 'AFI']);
    expect(schoolTabs(meta)[0].id).toBe(ALL_SCHOOLS);
  });
});
