import { describe, expect, it } from 'vitest';
import { athleteChanges, athleteValueText, birthDateForPicker, isDataIncomplete, missingFields, missingText, readAthleteInput, type AthleteValues } from '../athlete-data';
import { ADMIN_ERRORS } from '../athletes/errors';

const full: AthleteValues = { name: 'Maria Pop', birthDate: '2016-03-14', contactName: 'Ana Pop', phone: '0722111222', email: 'ana@example.com' };

describe('"Date incomplete" (spec 1.1, 3b Q20)', () => {
  it('is complete only with name, birth date, contact person, phone and e-mail', () => {
    expect(isDataIncomplete(full)).toBe(false);
    expect(missingFields({ ...full, email: null, birthDate: null })).toEqual(['birthDate', 'email']);
    expect(isDataIncomplete({ ...full, phone: null })).toBe(true);
  });

  it('words the missing fields like the hint', () => {
    expect(missingText(['birthDate', 'contactName', 'email'])).toBe('data nașterii, persoana de contact, e-mail');
  });
});

describe('readAthleteInput (Editează and Adaugă sportiv)', () => {
  it('reads the picker date into ISO and collapses spaces', () => {
    expect(readAthleteInput({ name: '  Maria   Pop ', birthDate: '14.03.2016', contactName: '', phone: ' 0722 ', email: null }, 'edit')).toEqual({
      ok: true,
      values: { name: 'Maria Pop', birthDate: '2016-03-14', contactName: null, phone: '0722', email: null },
    });
  });

  it('needs a name', () => {
    expect(readAthleteInput({ name: ' ' }, 'edit')).toEqual({ ok: false, error: ADMIN_ERRORS.nameRequired });
  });

  it('allows clearing the birth date when editing, not when adding (gaps #41)', () => {
    expect(readAthleteInput({ name: 'Maria', birthDate: '' }, 'edit')).toMatchObject({ ok: true, values: { birthDate: null } });
    expect(readAthleteInput({ name: 'Maria', birthDate: '' }, 'add')).toEqual({ ok: false, error: ADMIN_ERRORS.birthDate });
  });

  it('refuses a date that is not ZZ.LL.AAAA or not real', () => {
    expect(readAthleteInput({ name: 'Maria', birthDate: '2016-03-14' }, 'edit')).toEqual({ ok: false, error: ADMIN_ERRORS.birthDate });
    expect(readAthleteInput({ name: 'Maria', birthDate: '31.02.2016' }, 'add')).toEqual({ ok: false, error: ADMIN_ERRORS.birthDate });
  });

  it('reads a missing body as empty', () => {
    expect(readAthleteInput(null, 'edit')).toEqual({ ok: false, error: ADMIN_ERRORS.nameRequired });
  });
});

describe('changes and display', () => {
  it('lists old -> new per changed field', () => {
    expect(athleteChanges(full, { ...full, phone: '0733', email: null })).toEqual({
      phone: { from: '0722111222', to: '0733' },
      email: { from: 'ana@example.com', to: null },
    });
  });

  it('shows the birth date as ZZ.LL.AAAA and empties as blank', () => {
    expect(athleteValueText('birthDate', '2016-03-14')).toBe('14.03.2016');
    expect(athleteValueText('phone', null)).toBe('');
    expect(birthDateForPicker('2016-03-04')).toBe('04.03.2016');
    expect(birthDateForPicker(null)).toBeNull();
  });
});
