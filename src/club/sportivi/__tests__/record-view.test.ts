import { describe, expect, it } from 'vitest';
import type { AthleteRecord } from '../../athletes/api-types';
import {
  EMPTY_DRAFT, RECORD_COPY, acsLine, checkDraft, editDraft, fieldRows, historyWhen, menuItems, newAthleteDraft, recordSubline, recordTabs,
  registrationLine, saveToast, seasonFromState,
} from '../record-view';

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

describe('header (spec 6.1)', () => {
  it('sub-line: birth date and main group, or "data nașterii lipsește"', () => {
    expect(recordSubline(record())).toBe('14.03.2016, Primii Pași');
    expect(recordSubline(record({ header: { birthDate: null, mainGroup: 'Primii Pași' } }))).toBe('data nașterii lipsește, Primii Pași');
    expect(recordSubline(record({ header: { birthDate: '14.03.2016', mainGroup: null } }))).toBe('14.03.2016');
    expect(recordSubline(record({ header: { birthDate: null, mainGroup: null } }))).toBe('data nașterii lipsește');
  });

  it('tabs Date | Profil public | Documente | Istoric (n)', () => {
    expect(recordTabs(record())).toEqual([
      { id: 'date', label: 'Date' },
      { id: 'profil', label: 'Profil public' },
      { id: 'documente', label: 'Documente' },
      { id: 'istoric', label: 'Istoric', count: 4 },
    ]);
  });

  it('"..." menu: Marchează inactiv / activ, Unește cu alt sportiv, Șterge sportivul', () => {
    expect(menuItems('activ').map((i) => i.label)).toEqual(['Marchează inactiv', 'Unește cu alt sportiv', 'Șterge sportivul']);
    expect(menuItems('nou')[0].label).toBe('Marchează inactiv');
    expect(menuItems('inactiv')[0]).toEqual({ key: 'status', label: 'Marchează activ' });
  });

  it('the record season comes from the list (navigation state)', () => {
    expect(seasonFromState({ season: 's25' })).toBe('s25');
    expect([seasonFromState(null), seasonFromState({}), seasonFromState({ season: '' }), seasonFromState('s25')]).toEqual([null, null, null, null]);
  });
});

describe('Date tab (spec 6.2)', () => {
  it('rows in order, "lipsește" on missing fields, empty values blank', () => {
    const rows = fieldRows(record());
    expect(rows.map((r) => r.label)).toEqual(['Nume și prenume', 'Data nașterii', 'Persoana de contact', 'Telefon', 'E-mail']);
    expect(rows[4]).toEqual({ field: 'email', label: 'E-mail', value: '', missing: true });
    expect(rows[1].missing).toBe(false);
  });

  it('A.C.S. line and the "Înscrieri" rows', () => {
    expect(acsLine(record())).toBe('Membru A.C.S. 2026-2027: În așteptare');
    expect(acsLine(record({ acs: { seasonLabel: null, state: 'nu' } }))).toBeNull();
    expect(registrationLine(record().registrations[0])).toBe('2026-0142, 2026-2027, Confirmat');
    expect(registrationLine({ documentId: 'r2', number: null, season: '2025-2026', status: 'Nou' })).toBe('2025-2026, Nou');
  });

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

  it('copy from the spec', () => {
    expect(RECORD_COPY.requiredHint).toBe('Obligatorii pentru "complet": nume, data nașterii, persoana de contact, telefon, e-mail.');
    expect(RECORD_COPY.inactiveDialog).toEqual({ title: 'Marchezi sportivul ca inactiv?', message: 'Nu mai apare în liste. Istoricul rămâne.', confirm: 'Marchează inactiv' });
    expect(RECORD_COPY.deleteDialog.message('Ana Pop')).toBe(
      '„Ana Pop” se șterge definitiv, împreună cu profilul public, rezultatele și sezoanele. Înscrierile rămân, fără legătură. Acțiunea nu poate fi anulată.',
    );
    expect(RECORD_COPY.duplicate.line('Ana Pop')).toBe('Posibil același copil cu Ana Pop');
    expect([RECORD_COPY.duplicate.merge, RECORD_COPY.duplicate.dismiss]).toEqual(['Unește', 'Nu e același copil']);
    expect(RECORD_COPY.profile).toEqual({
      create: 'Creează profil public', nameHint: 'Numele se schimbă în Date.', note: 'Datele de contact și data nașterii nu ajung niciodată aici.',
    });
    expect(RECORD_COPY.noDocuments).toBe('Niciun document încă.');
  });
});
