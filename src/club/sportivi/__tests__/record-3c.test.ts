import { describe, expect, it } from 'vitest';
import type { AthleteRecord } from '../../athletes/api-types';
import { EXPORT_FALLBACK_NAME, anonymizeErrorText, anonymizeLines, exportUrl, recordMenuItems } from '../personal-data-view';
import { isReadOnlyRecord, recordSubline, recordTabs } from '../record-view';
import { inactiveListTo, wantsInactiveList } from '../routes';

const labels = (status: AthleteRecord['status'], superAdmin: boolean) => recordMenuItems(status, superAdmin).map((i) => i.label);

const RECORD = {
  documentId: 'a9', fields: { name: 'Sportiv anonimizat', birthDate: null, contactName: null, phone: null, email: null }, missing: [], status: 'anonimizat',
  dataIncomplete: false, header: { birthDate: null, mainGroup: 'Începători' }, season: null, acs: { seasonLabel: null, state: 'nu' },
  registrations: [], documents: [], profile: null, duplicates: [], historyCount: 4,
} as AthleteRecord;

describe('record menu (3C spec 3, 4, 6)', () => {
  it('export for every admin, anonymize only for a Super Admin, nothing on an anonymized record', () => {
    expect(labels('activ', false)).toEqual(['Marchează inactiv', 'Unește cu alt sportiv', 'Exportă datele', 'Șterge sportivul']);
    expect(labels('activ', true)).toEqual(['Marchează inactiv', 'Unește cu alt sportiv', 'Exportă datele', 'Anonimizează', 'Șterge sportivul']);
    expect(labels('inactiv', true)[0]).toBe('Marchează activ');
    expect(recordMenuItems('anonimizat', true)).toEqual([]);
  });

  it('the confirmation lines and the export address', () => {
    expect(anonymizeLines()).toEqual([
      'Se șterg: numele, data nașterii, contactul, telefonul, e-mailul, notele, datele din înscrieri, documentele PDF, adresele din coada de e-mail, valorile vechi din Istoric și profilul public.',
      'Rămân: grupele pe sezoane, statusul A.C.S. și numărul de înscrieri.',
      'Acțiunea nu poate fi anulată.',
    ]);
    expect(exportUrl('a b')).toBe('/api/club/athletes/a%20b/export');
    expect(EXPORT_FALLBACK_NAME).toBe('date.zip');
  });

  it('the confirmation error: the server text for 409, the shared text for 403 and 500', () => {
    const fail = (status: number, message: string) => ({ status, response: { status, data: { error: { status, message } } } });
    expect(anonymizeErrorText(fail(409, 'Datele s-au schimbat. Reîncarcă pagina.'))).toBe('Datele s-au schimbat. Reîncarcă pagina.');
    expect(anonymizeErrorText(fail(403, 'Policy Failed'))).toBe('Acțiunea nu a reușit. Nimic nu a fost salvat.');
    expect(anonymizeErrorText(fail(500, 'Internal Server Error'))).toBe('Acțiunea nu a reușit. Nimic nu a fost salvat.');
  });

  it('an anonymized record: read-only, Date, Plăți and Istoric only, sub-line without "data nașterii lipsește"', () => {
    expect(isReadOnlyRecord(RECORD)).toBe(true);
    expect(isReadOnlyRecord({ status: 'inactiv' })).toBe(false);
    expect(recordTabs(RECORD).map((t) => t.id)).toEqual(['date', 'plati', 'istoric']);
    expect(recordSubline(RECORD)).toBe('Începători');
  });

  it('the dashboard link to the inactivity list', () => {
    expect(inactiveListTo).toBe('/plugins/edusport-sportivi?inactivi=1');
    expect(wantsInactiveList('?inactivi=1')).toBe(true);
    expect(wantsInactiveList('?adauga=1')).toBe(false);
  });
});
