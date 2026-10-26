import { beforeEach, describe, expect, it } from 'vitest';
import { buildInscrieriMatrix, inscrieriPlan } from '../matrix';
import { installStrapi } from './fakes.test.helper';

const OLD_ROW = {
  documentId: 'doc-old',
  submittedAt: '2025-09-14T15:02:00.000Z',
  status: 'Confirmat',
  childName: 'Ana Bălan',
  childBirthDate: '2016-05-05',
  parentName: 'Elena Bălan',
  email: 'parinte3@exemplu.ro',
  phone: '0722000000',
  level: 'Incepatori',
  shirtSize: 'S',
  howHeard: 'Prieteni',
  clubInterest: true,
  regulationsAgreement: true,
  privacyConsent: false,
  priorExperience: '1 an',
  expectations: 'Piruete',
  internalNote: null,
  extra: { c1: true, retired: 'x' },
};

describe('Înscrieri columns as they are today (characterization)', () => {
  beforeEach(() => {
    installStrapi([], { removedBuiltins: ['level'], customs: [{ key: 'c1', label: 'Întrebare', type: 'checkbox' }] });
  });

  it('keeps the header, types and cells of the old tabs', async () => {
    const plan = await inscrieriPlan([OLD_ROW]);
    expect(plan.header).toEqual([
      'Trimis la', 'Stare', 'Nume copil', 'Data nasterii', 'Nume parinte', 'Email', 'Telefon', 'Nivel (eliminata)',
      'Marime tricou', 'Cum a aflat', 'Interes club', 'Acord regulament', 'Acord confidentialitate',
      'Experienta anterioara', 'Asteptari', 'Nota interna', 'Întrebare', 'retired (eliminata)', 'ID',
    ]);
    expect(plan.types).toEqual([
      'datetime', 'status', 'text', 'date', 'text', 'email', 'tel', 'text', 'text', 'text', 'bool', 'bool', 'bool',
      'longtext', 'longtext', 'longtext', 'bool', 'text', 'id',
    ]);
    expect(plan.row(OLD_ROW)).toEqual([
      '2025-09-14T15:02:00.000Z', 'Confirmat', 'Ana Bălan', '2016-05-05', 'Elena Bălan', 'parinte3@exemplu.ro',
      '0722000000', 'Incepatori', 'S', 'Prieteni', 'Da', 'Da', 'Nu', '1 an', 'Piruete', '', 'Da', 'x', 'doc-old',
    ]);
  });

  it('keeps the CSV export on the same columns', async () => {
    const m = await buildInscrieriMatrix([OLD_ROW]);
    expect(m.header[0]).toBe('Trimis la');
    expect(m.matrix).toHaveLength(1);
  });
});
