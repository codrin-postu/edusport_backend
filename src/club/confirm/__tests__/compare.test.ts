import { describe, expect, it } from 'vitest';
import type { AthleteValues } from '../../athlete-data';
import { comparisonRows, defaultUpdateFields, registrationValues } from '../compare';

const reg = { childName: ' Maria  Pop ', childBirthDate: '14.03.2016', parentName: 'Ana Pop', phone: '0722 111 222', email: 'ana@example.com' };
const athlete = (over: Partial<AthleteValues> = {}): AthleteValues => ({
  name: 'Maria Pop', birthDate: '2016-03-14', contactName: 'Ana Pop', phone: '0722111222', email: 'ana@example.com', ...over,
});

describe('registrationValues', () => {
  it('turns the answers into athlete values', () => {
    expect(registrationValues(reg)).toEqual({ name: 'Maria Pop', birthDate: '2016-03-14', contactName: 'Ana Pop', phone: '0722 111 222', email: 'ana@example.com' });
  });
});

describe('Compară și actualizează (spec 4.2)', () => {
  it('rows Nume, Data nașterii, Părinte, Telefon, E-mail; phone and e-mail compared normalised', () => {
    const rows = comparisonRows(athlete({ email: 'ANA@example.com' }), reg);
    expect(rows.map((r) => [r.label, r.differs])).toEqual([
      ['Nume', false], ['Data nașterii', false], ['Părinte', false], ['Telefon', false], ['E-mail', false],
    ]);
  });

  it('ticks every differing field by default except name and birth date', () => {
    const rows = comparisonRows(athlete({ name: 'Maria Popa', birthDate: '2016-03-15', contactName: 'Ion Pop', phone: '0733000000' }), reg);
    expect(rows.filter((r) => r.differs).map((r) => r.field)).toEqual(['name', 'birthDate', 'contactName', 'phone']);
    expect(defaultUpdateFields(rows)).toEqual(['contactName', 'phone']);
  });

  it('shows dates as ZZ.LL.AAAA, an unreadable one as typed, and empty cells blank', () => {
    const rows = comparisonRows(athlete({ contactName: null }), { ...reg, childBirthDate: 'martie 2016' });
    expect(rows[1]).toMatchObject({ athlete: '14.03.2016', registration: 'martie 2016', differs: true });
    expect(rows[2]).toMatchObject({ athlete: '', registration: 'Ana Pop', defaultUpdate: true });
  });

  it('never ticks by default an empty registration value (N3)', () => {
    const rows = comparisonRows(athlete(), { ...reg, email: '' });
    expect(rows[4]).toMatchObject({ differs: true, defaultUpdate: false });
  });
});
