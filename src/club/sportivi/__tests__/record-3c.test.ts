import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AthleteRecord } from '../../athletes/api-types';
import { PERSONAL_DATA_COPY } from '../../personal-data/copy';
import { EXPORT_FALLBACK_NAME, anonymizeErrorText, anonymizeLines, exportUrl, recordMenuItems } from '../personal-data-view';
import { isReadOnlyRecord, recordSubline, recordTabs } from '../record-view';
import { inactiveListTo, wantsInactiveList } from '../routes';

const read = (p: string) => readFileSync(join(__dirname, '..', '..', '..', 'admin', 'dashboard', p), 'utf8');
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

describe('record wiring (source, 3C spec 8)', () => {
  it('the menu: items by role, export through the detached client, the anonymize confirmation', () => {
    const menu = read('sportivi/RecordMenu.tsx');
    for (const s of [
      'recordMenuItems(record.status, superAdmin)', 'downloadPdf(getFetchClient().get, exportUrl(id), EXPORT_FALLBACK_NAME)', 'PERSONAL_DATA_COPY.exported',
      'adminToast.error(PERSONAL_DATA_COPY.exportFailed)', '<AnonymizeDialog', 'await api.anonymize(record.documentId)', 'PERSONAL_DATA_COPY.done(1)',
      'RECORD_COPY.menu.button', 'RECORD_COPY.inactiveDialog.title', 'RECORD_COPY.deleteDialog.message(', "api.setStatus(record.documentId, 'inactiv')",
      'navigate(SPORTIVI_PATH, { replace: true })',
    ]) expect(menu, s).toContain(s);
  });

  it('a failed export has its own text; after anonymizing, focus moves to the record heading', () => {
    expect(PERSONAL_DATA_COPY.exportFailed).toBe('Datele nu au putut fi exportate.');
    const menu = read('sportivi/RecordMenu.tsx');
    expect(menu).toContain("const RECORD_HEADING = '.ui-ph-title, .ui-sheet-title';");
    expect(menu).toContain('await reload().then(focusRecordHeading, () => undefined);');
    expect(menu).toMatch(/requestAnimationFrame\(\(\) => \{\s+const heading = document\.querySelector<HTMLElement>\(RECORD_HEADING\);\s+if \(!heading\) return;\s+heading\.tabIndex = -1;\s+heading\.focus\(\);/);
  });

  it('a reload failing after a saved anonymization never reaches the dialog as an error', () => {
    const menu = read('sportivi/RecordMenu.tsx');
    const body = menu.slice(menu.indexOf('const anonymize = async'), menu.indexOf('return (', menu.indexOf('const anonymize = async')));
    expect(body).toContain('() => undefined');
    expect(body).not.toMatch(/await reload\(\);/);
  });

  it('the confirmation copy comes from the copy module', () => {
    const dialog = read('sportivi/AnonymizeDialog.tsx');
    for (const s of ['PERSONAL_DATA_COPY.bulkTitle(count)', 'c.title', 'anonymizeLines()', 'confirmLabel={c.confirm}', 'busyLabel={c.busy}']) expect(dialog, s).toContain(s);
  });

  it('role gating reads /admin/users/me; the anonymized record has no menu and no "Editează"', () => {
    expect(read('sportivi/useSuperAdmin.ts')).toContain("client.get('/admin/users/me')");
    expect(read('sportivi/useSuperAdmin.ts')).toContain('superAdminFromMe(r.data)');
    const page = read('sportivi/AthleteRecordPage.tsx');
    for (const s of ['useIsSuperAdmin()', '!isReadOnlyRecord(record) && <RecordMenu', 'superAdmin={superAdmin}', 'STATUS_WORDS[record.status]']) expect(page, s).toContain(s);
    const date = read('sportivi/DateTab.tsx');
    expect(date).toContain('onEdit={readOnly ? null : edit.start}');
    expect(date).toContain('{!readOnly && <p className="ui-hint">');
  });

  it('the API client calls the 3C routes', () => {
    const api = read('sportivi/api.ts');
    for (const s of ['/anonymize`, {})', '`${BASE}/anonymize`, { documentIds }', '`${BASE}/inactive-summary`', '`${BASE}/inactive-summary/hide`']) expect(api, s).toContain(s);
  });
});
