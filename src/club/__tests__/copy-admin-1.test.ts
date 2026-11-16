import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONFIRM_COPY, EDIT_TOASTS, LIST_COPY as INSCRIERI_LIST, MATCH_COPY, PANEL_COPY } from '../inscrieri-copy';
import { CONFIRM_ERRORS, ADMIN_ERRORS } from '../athletes/errors';
import { PRESENCE_ERRORS } from '../presence/copy/core';
import { LIFECYCLE_DELETE, deleteBlockedText } from '../presence/copy/lifecycle';
import { PERSONAL_DATA_COPY } from '../personal-data/copy';
import { ACCESS_COPY } from '../portal/access/copy';
import { ACCOUNT_BLOCK } from '../portal/copy-admin';
import { LIST_COPY } from '../sportivi/list-view';
import { MERGE_COPY } from '../sportivi/merge-view';
import { ADD_COPY, SEARCH_COPY } from '../sportivi/search-view';
import { RECORD_COPY } from '../sportivi/record-view';
import { TABLES_COPY } from '../tables/copy';
import { TOO_MANY_ROWS } from '../tables/query';

const src = (file: string): string => readFileSync(join(__dirname, '../../', file), 'utf8');

describe('admin copy 1: Inscrieri, Sportivi, Tabele', () => {
  it('uses the short repeated forms', () => {
    expect(PANEL_COPY.undoDialog.message).toBe('Se anulează legătura cu fișa, grupa și statusul A.C.S.');
    expect(src('admin/dashboard/InscrieriPage.tsx')).toContain("'Ștergi înscrierea și documentele ei? Nu se poate anula.'");
    expect(RECORD_COPY.deleteDialog.message('Ana')).toBe('"Ana" se șterge cu profilul public, rezultatele și sezoanele. Înscrierile rămân, fără legătură. Nu se poate anula.');
    expect(MERGE_COPY.confirmMessage('Ana')).toBe('Rămâne fișa "Ana". Cealaltă se șterge. Nu se poate anula.');
    expect(PERSONAL_DATA_COPY.dialog.final).toBe('Nu se poate anula.');
    expect(INSCRIERI_LIST.searchPlaceholder).toBe('Nume, nr., telefon, e-mail');
    expect(LIST_COPY.search).toBe('Nume, telefon, e-mail, nr.');
    expect(SEARCH_COPY.placeholder).toBe('Caută sportiv');
    expect(CONFIRM_COPY.searchPlaceholder).toBe('Caută sportiv');
    expect(src('admin/dashboard/InscrieriPage.tsx')).toContain("empty: 'Nicio înscriere.'");
    expect(LIST_COPY.empty).toBe('Niciun sportiv.');
    expect(TABLES_COPY.empty.sportivi).toBe('Niciun sportiv.');
    expect(CONFIRM_ERRORS.failed).toBe('Confirmarea a eșuat.');
    expect(CONFIRM_ERRORS.birthDate).toBe('Corectează data nașterii în Date.');
    expect(ADMIN_ERRORS.failed).toBe('Nu s-a salvat nimic.');
    expect(PRESENCE_ERRORS.failed).toBe('Nu s-a salvat nimic.');
    expect(TABLES_COPY.views.duplicate).toBe('Numele e deja folosit.');
    expect(TABLES_COPY.errors.tooMany).toBe('Peste 5.000 de rânduri. Adaugă filtre.');
    expect(TOO_MANY_ROWS).toBe(TABLES_COPY.errors.tooMany);
    expect(TABLES_COPY.errors.tooSlow).toBe('Prea lent. Restrânge sfera.');
    expect(Object.values(TABLES_COPY.notices).slice(0, 3)).toEqual(['Coloană scoasă.', 'Filtru scos.', 'Grupare scoasă.']);
  });

  it('keeps placeholders', () => {
    expect(CONFIRM_COPY.newHint('Ana Pop')).toBe('Fișă nouă: Ana Pop');
    expect(RECORD_COPY.deleteDialog.message('Ana Pop')).toContain('Ana Pop');
    expect(MERGE_COPY.confirmMessage('Ana Pop')).toContain('Ana Pop');
    expect(ACCESS_COPY.disableAllConfirm('Ana Pop')).toBe('Dezactivezi tot contul lui Ana Pop? Toate dispozitivele se deconectează.');
    expect(deleteBlockedText(2, 1)).toBe('Sportivul are 2 plăți și 1 abonament, deci nu se poate șterge.');
    expect(LIFECYCLE_DELETE.anonymizeInstead).toBe('Îl poți anonimiza: datele personale se șterg, plățile rămân.');
    expect(ACCOUNT_BLOCK.coachSideOff).toBe('Antrenor dezactivat. Accesul de părinte rămâne.');
  });

  it('shortens the confirm window and toasts', () => {
    expect(MATCH_COPY.notAttended).toBe('Nu a participat sezonul trecut.');
    expect(EDIT_TOASTS.rebuilt).toBe('Salvat. Documentul refăcut.');
    expect(EDIT_TOASTS.rebuildFailed).toBe('Salvat. PDF-ul nu s-a refăcut.');
    expect(CONFIRM_COPY.pickHint).toBe('Alege una dintre cele două.');
    expect(CONFIRM_COPY.intentHeading).toBe('Abonament dorit');
    expect('existingHint' in CONFIRM_COPY).toBe(false);
  });

  it('has no banned characters', () => {
    const banned = /[–—·‘’“”]|\p{Extended_Pictographic}/u;
    const all = [CONFIRM_COPY, MATCH_COPY, PANEL_COPY, EDIT_TOASTS, CONFIRM_ERRORS, ADMIN_ERRORS, PRESENCE_ERRORS, LIFECYCLE_DELETE, PERSONAL_DATA_COPY, ACCOUNT_BLOCK, LIST_COPY, MERGE_COPY, ADD_COPY, SEARCH_COPY, RECORD_COPY, TABLES_COPY];
    for (const copy of all) expect(JSON.stringify(copy)).not.toMatch(banned);
  });

  it('shows the e-mail state as an icon, with no line under a failed one', () => {
    const email = src('admin/dashboard/inscrieri/RegistrationEmail.tsx');
    expect(email).toContain('IconClock');
    expect(email).toContain('IconWarning');
    expect(email).not.toContain('failedEmailError');
    expect(src('club/registration-panel.ts')).not.toContain('Apasă Retrimite');
  });

  it('removes the hints and subtitles', () => {
    expect(src('admin/dashboard/sportivi/AddAthleteDialog.tsx')).not.toContain('Opțional');
    expect(ADD_COPY).not.toHaveProperty('optional');
    expect(src('admin/dashboard/InscrieriPage.tsx')).not.toMatch(/subtitle:/);
    expect(LIST_COPY).not.toHaveProperty('subtitle');
    expect(src('admin/dashboard/sportivi/ProfileTab.tsx')).not.toContain('profile.note');
    const editor = src('admin/dashboard/sportivi/ProfileEditor.tsx');
    expect(editor).not.toContain('Fiecare rând');
    expect(editor).toMatch(/<HelpTip icon="lock"/);
  });

  it('marks the five required labels of the Date tab', () => {
    const date = src('admin/dashboard/sportivi/DateTab.tsx');
    expect(date.match(/<Field label=\{label\('[a-zA-Z]+'\)\}[^>]*required/g)).toHaveLength(5);
    expect(date).not.toContain('Obligatorii pentru');
  });

  it('gives HelpTip a lock icon', () => {
    expect(src('admin/ui/HelpTip.tsx')).toContain("icon?: 'info' | 'lock'");
    expect(src('admin/ui/icons.tsx')).toContain('export const IconLock');
  });
});
