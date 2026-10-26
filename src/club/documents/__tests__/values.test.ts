import { describe, expect, it } from 'vitest';
import type { DocumentSeason } from '../types';
import { blankValues, documentKindsFor, registrationValues } from '../values';

const SEASON: DocumentSeason = { label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', membershipFee: 270 };
const ROW = {
  documentId: 'reg0000000000000000000001',
  registrationNumber: '2026-0142',
  parentName: ' Mihaela Dumitrescu ',
  phone: '0723456789',
  email: 'parinte@exemplu.ro',
  relationship: 'parinte',
  childName: 'Maria Dumitrescu',
  childBirthDate: '2014-03-14',
  membershipAnswer: 'da',
  submittedAt: '2026-10-03T08:00:00.000Z',
  season: '2026-2027',
};

describe('document values', () => {
  it('prints only the form answers, the number, the submit day and the Sezon', () => {
    expect(registrationValues(ROW, SEASON)).toEqual({
      registrationNumber: '2026-0142',
      parentName: 'Mihaela Dumitrescu',
      phone: '0723456789',
      email: 'parinte@exemplu.ro',
      relationship: 'Părinte',
      childName: 'Maria Dumitrescu',
      birthDate: '14.03.2014',
      date: '03.10.2026',
      season: '2026-2027',
      periodStart: 'octombrie 2026',
      periodEnd: 'mai 2027',
      fee: '270 ron',
    });
  });

  it('leaves missing answers blank and falls back to the season label of old registrations', () => {
    const values = registrationValues({ documentId: 'reg0000000000000000000002', season: '2025-2026' }, null);
    expect(values).toMatchObject({ registrationNumber: null, relationship: null, childName: null, season: '2025-2026', periodStart: null, fee: null });
  });

  it('a blank form prints only season, period and fee', () => {
    expect(blankValues(SEASON)).toEqual({
      registrationNumber: null,
      parentName: null,
      phone: null,
      email: null,
      relationship: null,
      childName: null,
      birthDate: null,
      date: null,
      season: '2026-2027',
      periodStart: 'octombrie 2026',
      periodEnd: 'mai 2027',
      fee: '270 ron',
    });
    expect(blankValues(null).season).toBeNull();
  });

  it('adds the Cerere de adeziune only for membership Da', () => {
    expect(documentKindsFor(ROW)).toEqual(['acord', 'adeziune']);
    expect(documentKindsFor({ ...ROW, membershipAnswer: 'nu' })).toEqual(['acord']);
    expect(documentKindsFor({ ...ROW, membershipAnswer: null })).toEqual(['acord']);
  });
});
