import { describe, expect, it } from 'vitest';
import type { AthleteRecord } from '../../athletes/api-types';
import { EMPTY_DRAFT, checkDraft, editDraft, historyWhen, newAthleteDraft, saveToast } from '../record-view';

const record = (over: Partial<AthleteRecord> = {}): AthleteRecord => ({
  documentId: 'a1',
  fields: { name: 'Maria Pop', birthDate: '14.03.2016', contactName: 'Ana Pop', phone: '0722 000 000', email: null },
  missing: ['email'],
  status: 'activ',
  dataIncomplete: true,
  header: { birthDate: '14.03.2016', mainGroup: 'Primii Pași' },
  season: { documentId: 's26', label: '2026-2027' },
  acs: { seasonLabel: '2026-2027', state: 'in_asteptare' },
  registrations: [{ documentId: 'r1', number: '2026-0142', season: '2026-2027', status: 'Confirmat' }],
  documents: [],
  profile: null,
  duplicates: [],
  historyCount: 4,
  ...over,
});

describe('Date tab (spec 6.2)', () => {

  it('toasts after saving (Needs decision 5, option A for no change)', () => {
    expect(saveToast({ record: record(), changed: [] })).toBe('Nicio modificare.');
    expect(saveToast({ record: record({ missing: ['birthDate', 'email'] }), changed: ['phone'] })).toBe('Salvat. Mai lipsesc: data nașterii, e-mail.');
    expect(saveToast({ record: record({ missing: [] }), changed: ['email'] })).toBe('Salvat. Datele sunt complete.');
  });

  it('the draft starts from the record; the picker gets the stored date', () => {
    expect(editDraft(record())).toEqual({ name: 'Maria Pop', birth: { day: 14, month: 3, year: 2016 }, contactName: 'Ana Pop', phone: '0722 000 000', email: '' });
    expect(editDraft(record({ fields: { ...record().fields, birthDate: null } })).birth).toEqual({ day: null, month: null, year: null });
    expect(newAthleteDraft('  Ion Pop ')).toEqual({ ...EMPTY_DRAFT, name: 'Ion Pop' });
  });

  it('checkDraft: trimmed body, name required, no half or impossible date', () => {
    const d = editDraft(record());
    expect(checkDraft({ ...d, name: ' Maria  Pop ', email: ' m@x.ro ' }, false)).toEqual({
      ok: true, body: { name: 'Maria  Pop', birthDate: '14.03.2016', contactName: 'Ana Pop', phone: '0722 000 000', email: 'm@x.ro' },
    });
    expect(checkDraft({ ...d, name: '  ' }, false)).toEqual({ ok: false, field: 'name', error: 'Completați numele.' });
    expect(checkDraft({ ...d, birth: { day: 14, month: 3, year: null } }, false)).toEqual({ ok: false, field: 'birthDate', error: 'Alegeți data nașterii.' });
    expect(checkDraft({ ...d, birth: { day: 31, month: 4, year: 2016 } }, false)).toMatchObject({ ok: false, field: 'birthDate' });
  });

  it('an empty date is allowed on Date and refused by "Adaugă sportiv" (gaps #41)', () => {
    const blank = { ...editDraft(record()), birth: { day: null, month: null, year: null } };
    expect(checkDraft(blank, false)).toMatchObject({ ok: true, body: { birthDate: '' } });
    expect(checkDraft(blank, true)).toEqual({ ok: false, field: 'birthDate', error: 'Alegeți data nașterii.' });
  });
});

describe('Istoric and copy', () => {
  it('time in Bucharest, "3 oct 2026, 14:22" (Needs decision 8, option A)', () => {
    expect(historyWhen('2026-10-03T11:22:00.000Z')).toBe('3 oct 2026, 14:22');
    expect(historyWhen('2026-12-01T08:05:00.000Z')).toBe('1 dec 2026, 10:05');
    expect(historyWhen('nope')).toBe('');
  });
});
