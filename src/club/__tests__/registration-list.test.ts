import { describe, expect, it } from 'vitest';
import { listRowExtras, publicListRow, registrationSchools } from '../registration-list';

const TODAY = { year: 2026, month: 10, day: 26 };

describe('list row extras (spec 3.1)', () => {
  it('age today, the "Sportiv existent" line only while unconfirmed', () => {
    expect(listRowExtras({ childBirthDate: '14.03.2016', matchLevel: 'probabil', athlete: null }, TODAY)).toMatchObject({ age: 10, existingAthlete: true, athleteId: null, canUndo: false });
    expect(listRowExtras({ childBirthDate: 'ieri', matchLevel: 'sigur', athlete: { documentId: 'a1', name: 'Maria' } }, TODAY)).toMatchObject({ age: null, existingAthlete: false, athleteId: 'a1', athleteName: 'Maria' });
  });

  it('flags a registration whose linked athlete is anonymized (3C spec 4)', () => {
    expect(listRowExtras({ athlete: { documentId: 'a1', name: 'Sportiv anonimizat', status: 'anonimizat' } }, TODAY).athleteAnonymized).toBe(true);
    expect(listRowExtras({ athlete: { documentId: 'a1', name: 'Maria', status: 'activ' } }, TODAY).athleteAnonymized).toBe(false);
    expect(listRowExtras({ athlete: null }, TODAY).athleteAnonymized).toBe(false);
  });

  it('offers the undo only when the confirmation record names the linked athlete', () => {
    expect(listRowExtras({ athlete: { documentId: 'a1' }, confirmation: { athleteId: 'a1' } }, TODAY).canUndo).toBe(true);
    expect(listRowExtras({ athlete: { documentId: 'a1' }, confirmation: null }, TODAY).canUndo).toBe(false);
  });

  it('never sends the internal fields', () => {
    const row = publicListRow({ documentId: 'r1', childName: 'Maria', confirmation: { athleteId: 'a1' }, matchAthlete: { documentId: 'a1' }, matchLevel: 'sigur', submissionKey: 'k', section: { documentId: 'afi', name: 'AFI' }, childBirthDateParsed: '2016-03-14' }, TODAY);
    expect(Object.keys(row).sort()).toEqual(['age', 'athleteAnonymized', 'athleteId', 'athleteName', 'canUndo', 'childName', 'documentId', 'existingAthlete', 'schoolId', 'schoolName']);
    expect(row.schoolName).toBe('AFI');
  });
});

describe('school tabs (spec 3.6)', () => {
  it('lists the schools with a public page, Club never', () => {
    expect(registrationSchools([
      { documentId: 'club', name: 'Club', kind: 'club', publicPage: true, order: 0 },
      { documentId: 'p2', name: 'Patinoar 2', kind: 'school', publicPage: true, order: 2 },
      { documentId: 'afi', name: 'AFI', kind: 'school', publicPage: true, order: 1 },
      { documentId: 'old', name: 'Veche', kind: 'school', publicPage: false, order: 3 },
    ])).toEqual([{ documentId: 'afi', name: 'AFI' }, { documentId: 'p2', name: 'Patinoar 2' }]);
  });
});
