import { describe, expect, it } from 'vitest';
import {
  asciiWords,
  blankFileName,
  documentFileName,
  formatBirthDate,
  formatDay,
  formatFee,
  kindFromFileName,
  monthYear,
  relationshipLabel,
} from '../format';

describe('document formats', () => {
  it('prints Sezon months in Romanian', () => {
    expect(monthYear('2026-10-01')).toBe('octombrie 2026');
    expect(monthYear('2027-05-31')).toBe('mai 2027');
    expect(monthYear('')).toBeNull();
    expect(monthYear('2026-13-01')).toBeNull();
  });

  it('prints the birth date as dd.mm.yyyy whatever the form sent', () => {
    expect(formatBirthDate('2014-03-14')).toBe('14.03.2014');
    expect(formatBirthDate('4.3.2014')).toBe('04.03.2014');
    expect(formatBirthDate('14/03/2014')).toBe('14.03.2014');
    expect(formatBirthDate(' martie 2014 ')).toBe('martie 2014');
    expect(formatBirthDate('')).toBeNull();
  });

  it('prints the submit day in Romanian time', () => {
    expect(formatDay('2026-10-02T22:30:00.000Z')).toBe('03.10.2026');
    expect(formatDay('nu e o dată')).toBeNull();
    expect(formatDay(null)).toBeNull();
  });

  it('prints the fee as the Cerere does', () => {
    expect(formatFee(270)).toBe('270 ron');
    expect(formatFee(270.5)).toBe('270,5 ron');
    expect(formatFee(null)).toBeNull();
  });

  it('prints the relationship label, or the free text for Alta', () => {
    expect(relationshipLabel('parinte', null)).toBe('Părinte');
    expect(relationshipLabel('tutore', 'ignored')).toBe('Tutore Legal');
    expect(relationshipLabel('alta', ' Bunic ')).toBe('Bunic');
    expect(relationshipLabel('alta', '')).toBeNull();
    expect(relationshipLabel(null, null)).toBeNull();
  });

  it('names files Nume_Prenume_Tip-document_Sezon.pdf without diacritics', () => {
    expect(asciiWords('  Maria-Ștefania  Țăranu ')).toBe('Maria_Stefania_Taranu');
    expect(asciiWords('Ioana Şerban')).toBe('Ioana_Serban');
    expect(documentFileName('acord', 'Maria Dumitrescu', '2026-2027', '2026-0142')).toBe('Maria_Dumitrescu_Acord_2026-2027.pdf');
    expect(documentFileName('adeziune', 'Îonuț Bâlă', '2026-2027', '')).toBe('Ionut_Bala_Adeziune_2026-2027.pdf');
    expect(documentFileName('acord', '', null, '2026-0142')).toBe('2026_0142_Acord_fara-sezon.pdf');
    expect(blankFileName('adeziune', '2026-2027')).toBe('Formular-gol_Adeziune_2026-2027.pdf');
  });

  it('reads the kind back from a stored file name', () => {
    expect(kindFromFileName('Maria_Dumitrescu_Acord_2026-2027.pdf')).toBe('acord');
    expect(kindFromFileName('Maria_Dumitrescu_Adeziune_2026-2027.pdf')).toBe('adeziune');
    expect(kindFromFileName('Maria_Dumitrescu_Acord_2026-2027.pdf.abc.tmp')).toBeNull();
    expect(kindFromFileName('notes.txt')).toBeNull();
  });
});
