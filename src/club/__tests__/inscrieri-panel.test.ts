import { describe, expect, it } from 'vitest';
import type { AthleteCard, RegistrationMatchView } from '../athletes/api-types';
import { CONFIRM_COPY, EDIT_TOASTS, INSCRIERI_PENDING_COPY, LIST_COPY, MATCH_COPY, PANEL_COPY } from '../inscrieri-copy';
import {
  ALL_SCHOOLS,
  CLUB_URLS,
  PANEL_STATUSES,
  abonamentTabRows,
  ageText,
  athleteRecordPath,
  cardDetailLine,
  cellText,
  compactHeaders,
  dateTabRows,
  footerActions,
  historyHead,
  initials,
  inscrieriOpenPath,
  lastGroupText,
  listParams,
  menuItems,
  moveTargets,
  moveToasts,
  openListParams,
  panelTabs,
  panelVersion,
  readListMeta,
  readOpenParam,
  schoolTabs,
  showMatchCard,
  statusMenuValues,
  wishText,
} from '../inscrieri-panel';

const script = {
  documentId: 'r1', registrationNumber: '2026-0142', status: 'Nou', archived: false, athleteId: null, canUndo: false,
  email: 'parinte@exemplu.ro', parentName: 'Mihaela Dumitrescu', relationship: 'parinte', phone: '0722 111 222',
  childName: 'Maria Dumitrescu', childBirthDate: '14.03.2014', childHeight: 142, shirtSize: 'S', lastSeason: 'Începători',
  priorExperience: 'Patinaj înainte', expectations: null, membershipAnswer: 'da',
  subscriptionChoice: { priceItemName: 'Abonament 8 ședințe grup', price: 590 }, source: 'Recomandare',
  gdprConsent: true, regulationsConsent: true, existingAthlete: true, age: 12, updatedAt: '2026-10-20T10:00:00.000Z',
};
const legacy = {
  documentId: 'r7', status: 'Nou', childName: 'Mihai Pop', childBirthDate: null, parentName: 'Ion Pop', email: '', phone: '0711',
  level: 'Incepatori', howHeard: 'Facebook', clubInterest: true, regulationsAgreement: true, privacyConsent: false, shirtSize: undefined,
};
const card = (over: Partial<AthleteCard> = {}): AthleteCard => ({
  documentId: 'a1', name: 'Maria Dumitrescu', birthDate: '14.03.2014', lastGroup: { name: 'Primii Pași', season: '2025-2026' },
  lastRegistrationSeason: '2025-2026', contactName: 'Mihaela Dumitrescu', status: 'activ', ...over,
});
const view = (over: Partial<RegistrationMatchView> = {}): RegistrationMatchView => ({
  confirmed: false, athleteId: null, canConfirm: true, canUndo: false, birthDateReadable: true, notAttendedLastSeason: false,
  existing: card(), preselect: 'existing', comparison: [], candidates: [], ...over,
});
const values = (rows: { label: string; value: string }[]) => rows.map((r) => [r.label, r.value]);

describe('Înscrieri list (spec 3.1, 3.6)', () => {
  it('has the prototype v5 columns, "Școala" after the name only with 2+ schools, "Vârstă" sortable', () => {
    expect(compactHeaders(false)).toEqual([
      'Nr.', 'Trimis la', 'Nume sportiv', { label: 'Vârstă', sort: ['age-asc', 'age-desc'] }, 'Status', 'Completat de', 'Dorește să fie membru',
    ]);
    expect(compactHeaders(true).slice(2, 4)).toEqual(['Nume sportiv', 'Școala']);
  });

  it('leaves the age and wish cells blank when unknown', () => {
    expect([ageText(12), ageText(0), ageText(null), ageText(undefined), ageText(-1), ageText('12')]).toEqual(['12 ani', '0 ani', '', '', '', '']);
    expect([wishText('da'), wishText('nu'), wishText(null), wishText('poate')]).toEqual(['Da', 'Nu', '', '']);
    expect([cellText('  x '), cellText(5), cellText(null), cellText(undefined), cellText({})]).toEqual(['x', '5', '', '', '']);
  });

  it('reads the school data of the list answer defensively', () => {
    expect(readListMeta({})).toEqual({ schools: [], multipleSchools: false, allSchoolsTotal: 0 });
    const meta = readListMeta({ schools: [{ documentId: 'afi', name: 'AFI', count: 52 }, { bad: 1 }, null], multipleSchools: true, allSchoolsTotal: 64 });
    expect(meta.schools).toEqual([{ documentId: 'afi', name: 'AFI', count: 52 }]);
    expect(schoolTabs(meta)).toEqual([{ id: ALL_SCHOOLS, label: 'Toate', count: 64 }, { id: 'afi', label: 'AFI', count: 52 }]);
  });

  it('sends existing=da|nu, and the school only with 2+ schools', () => {
    const two = readListMeta({ multipleSchools: true });
    expect(listParams('', ALL_SCHOOLS, two)).toEqual({});
    expect(listParams('da', 'afi', two)).toEqual({ existing: 'da', school: 'afi' });
    expect(listParams('nu', 'afi', readListMeta({}))).toEqual({ existing: 'nu' });
    expect(listParams('poate', ALL_SCHOOLS, two)).toEqual({});
  });

  it('offers the other schools as move targets and names the school in the toasts', () => {
    const meta = readListMeta({ schools: [{ documentId: 'afi', name: 'AFI', count: 1 }, { documentId: 'p2', name: 'Patinoar 2', count: 1 }], multipleSchools: true });
    expect(moveTargets(meta, 'afi')).toEqual([{ value: 'p2', label: 'Patinoar 2' }]);
    expect(moveToasts({ moved: 1, skipped: 0 }, 'Patinoar 2', true)).toEqual([{ tone: 'success', text: 'Mutată la Patinoar 2.' }]);
    expect(moveToasts({ moved: 2, skipped: 1 }, 'AFI', false)).toEqual([
      { tone: 'success', text: 'Mutate la AFI: 2.' },
      { tone: 'warning', text: 'Nemutate (deja confirmate): 1.' },
    ]);
  });
});

describe('panel (spec 3.3, 3.5)', () => {
  it('has the four tabs with the document and history counts', () => {
    expect(panelTabs(script, 3)).toEqual([
      { id: 'date', label: 'Date' },
      { id: 'abonament', label: 'Abonament' },
      { id: 'documente', label: 'Documente', count: 2 },
      { id: 'istoric', label: 'Istoric', count: 3 },
    ]);
    expect(panelTabs({ ...script, membershipAnswer: 'nu' }, null)[2].count).toBe(1);
    expect(panelTabs(legacy, null).map((t) => t.count)).toEqual([undefined, undefined, 0, null]);
  });

  it('Date tab: the form wording, in form order, blank empties', () => {
    expect(values(dateTabRows(script))).toEqual([
      ['Adresă de e-mail', 'parinte@exemplu.ro'],
      ['Persoana care completează', 'Mihaela Dumitrescu'],
      ['Calitatea față de sportiv', 'Părinte'],
      ['Telefon de contact', '0722 111 222'],
      ['Numele copilului', 'Maria Dumitrescu'],
      ['Data nașterii copilului', '14.03.2014'],
      ['Înălțimea copilului (cm)', '142'],
      ['Măsura bluză', 'S'],
      ['Sezonul trecut a participat la cursurile ACS EduSport?', 'Începători'],
      ['Nivel de experiență / Elemente cunoscute', 'Patinaj înainte'],
      ['Așteptări de la cursurile de patinaj', ''],
    ]);
    expect(dateTabRows({ ...script, relationship: 'alta', relationshipOther: 'Bunic' })[2].value).toBe('Bunic');
  });

  it('Abonament tab: the wish in the form words, read-only rows', () => {
    expect(values(abonamentTabRows(script))).toEqual([
      ['Dorește să fie membru', 'Da, doresc să devin membru'],
      ['La primul modul', 'Abonament 8 ședințe grup'],
      ['De unde ați aflat', 'Recomandare'],
      ['Acord GDPR', 'Da'],
      ['Acord Regulament', 'Da'],
    ]);
    expect(abonamentTabRows({ ...script, membershipAnswer: 'nu' })[0].value).toBe('Nu, optez pentru tarife neafiliați');
  });

  it('old registrations keep their own answers, never "-", "—", "undefined" or "null" (Needs decision 3, A)', () => {
    const all = [...dateTabRows(legacy), ...abonamentTabRows(legacy)];
    expect(values(all)).toEqual([
      ['Email', ''], ['Nume părinte', 'Ion Pop'], ['Telefon', '0711'], ['Nume sportiv', 'Mihai Pop'], ['Data nașterii', ''],
      ['Mărime tricou', ''], ['Nivel', 'Incepatori'], ['Experiență anterioară', ''], ['Așteptări', ''],
      ['Interes club', 'Da'], ['Cum a aflat', 'Facebook'], ['Acord regulament', 'Da'], ['Acord confidențialitate', 'Nu'],
    ]);
    expect(all.some((r) => /^(-|—|undefined|null)$/.test(r.value))).toBe(false);
  });

  it('footer: Contactat unless already, Confirmă unless Respins or archived, the record link once confirmed', () => {
    expect(footerActions(script)).toEqual({ contactat: true, confirm: true, openAthlete: false });
    expect(footerActions({ ...script, status: 'Contactat' })).toEqual({ contactat: false, confirm: true, openAthlete: false });
    expect(footerActions({ ...script, status: 'Respins' })).toEqual({ contactat: true, confirm: false, openAthlete: false });
    expect(footerActions({ ...script, archived: true })).toEqual({ contactat: true, confirm: false, openAthlete: false });
    expect(footerActions({ ...script, status: 'Confirmat' })).toEqual({ contactat: true, confirm: true, openAthlete: false });
    expect(footerActions({ ...script, status: 'Confirmat', athleteId: 'a1' })).toEqual({ contactat: false, confirm: false, openAthlete: true });
  });

  it('"..." menu: undo only when the window confirmed it, move only with 2+ schools and before confirmation', () => {
    expect(menuItems(script, false)).toEqual(['delete']);
    expect(menuItems(script, true)).toEqual(['move', 'delete']);
    expect(menuItems({ ...script, athleteId: 'a1', canUndo: true }, true)).toEqual(['undo', 'delete']);
    expect(menuItems({ ...script, athleteId: 'a1', canUndo: false }, true)).toEqual(['delete']);
  });

  it('status menu: never "Confirmat", none on a "Confirmat" row (Needs decision 2, A)', () => {
    expect([...PANEL_STATUSES]).toEqual(['Nou', 'Contactat', 'Respins']);
    expect(statusMenuValues(script)).toEqual(['Nou', 'Contactat', 'Respins']);
    expect(statusMenuValues({ ...script, status: 'Confirmat' })).toEqual([]);
    expect(statusMenuValues({ ...script, status: 'ciudat' })).toEqual(['Nou', 'Contactat', 'Respins']);
  });

  it('reloads the panel data when the status, the link or the save time change', () => {
    expect(panelVersion(script)).not.toBe(panelVersion({ ...script, status: 'Contactat' }));
    expect(panelVersion(script)).not.toBe(panelVersion({ ...script, athleteId: 'a1' }));
    expect(panelVersion(script)).not.toBe(panelVersion({ ...script, updatedAt: '2026-10-21T10:00:00.000Z' }));
  });
});

describe('match card, search rows, history and links (spec 3.3, 4.1, 1.6)', () => {
  it('initials from the first and last word', () => {
    expect([initials('Maria Dumitrescu'), initials('Sara-Maria Ilie'), initials('ion'), initials('  ')]).toEqual(['MD', 'SI', 'I', '']);
  });

  it('the last group, else "Ultima înscriere: <sezon>", else blank', () => {
    expect(lastGroupText(card())).toBe('Primii Pași 2025-2026');
    expect(lastGroupText(card({ lastGroup: null }))).toBe('Ultima înscriere: 2025-2026');
    expect(lastGroupText(card({ lastGroup: null, lastRegistrationSeason: null }))).toBe('');
  });

  it('search rows: birth date, last group and parent, separated by commas, empties left out', () => {
    expect(cardDetailLine(card())).toBe('14.03.2014, Primii Pași 2025-2026, Mihaela Dumitrescu');
    expect(cardDetailLine(card({ birthDate: null, lastGroup: null }))).toBe('Mihaela Dumitrescu');
  });

  it('shows the card only while unconfirmed and with a proposed athlete', () => {
    expect(showMatchCard(view())).toBe(true);
    expect(showMatchCard(view({ confirmed: true }))).toBe(false);
    expect(showMatchCard(view({ existing: null }))).toBe(false);
    expect(showMatchCard(null)).toBe(false);
  });

  it('history head: date and time, then who, separated by a comma', () => {
    const fmt = () => '3 oct 2026, 14:22';
    expect(historyHead({ at: 'x', actor: 'Ana Pop', text: 't' }, fmt)).toBe('3 oct 2026, 14:22, Ana Pop');
    expect(historyHead({ at: 'x', actor: '', text: 't' }, fmt)).toBe('3 oct 2026, 14:22');
  });

  it('reads ?open=<documentId> from the page address (the record\'s "Înscrieri" links)', () => {
    expect(readOpenParam('?open=r1')).toBe('r1');
    expect(readOpenParam('?q=x&open=%20r%201%20&season=all')).toBe('r 1');
    expect(readOpenParam(inscrieriOpenPath('abc').split('?')[1])).toBe('abc');
    expect([readOpenParam(''), readOpenParam('?open='), readOpenParam('?open=%20%20'), readOpenParam('?q=r1')]).toEqual([null, null, null, null]);
    expect(openListParams('r1')).toEqual({ open: 'r1', season: 'all', archived: 'all' });
  });

  it('links and routes', () => {
    expect(athleteRecordPath('a 1')).toBe('/plugins/edusport-sportivi/a%201');
    expect(inscrieriOpenPath('r 1')).toBe('/plugins/edusport-inscrieri?open=r%201');
    expect(CLUB_URLS.confirmContext('r1', null)).toBe('/api/club/registrations/r1/confirm-context');
    expect(CLUB_URLS.confirmContext('r1', 'a1')).toBe('/api/club/registrations/r1/confirm-context?athlete=a1');
    expect(CLUB_URLS.athleteSearch('Dumit', 'r1')).toBe('/api/club/athletes/search?q=Dumit&registration=r1');
    expect(CLUB_URLS.athleteSearch('', null)).toBe('/api/club/athletes/search?q=');
    expect(CLUB_URLS.undo('r1')).toBe('/api/club/registrations/r1/undo-confirmation');
    expect(CLUB_URLS.moveSchoolBulk).toBe('/api/club/registrations/move-school');
  });
});

describe('copy (spec copy rules)', () => {
  const strings = (o: unknown): string[] => {
    if (typeof o === 'string') return [o];
    if (typeof o === 'function') return [String((o as (...a: unknown[]) => unknown)('X', 'Y'))];
    return o && typeof o === 'object' ? Object.values(o).flatMap(strings) : [];
  };
  const all = [LIST_COPY, PANEL_COPY, MATCH_COPY, EDIT_TOASTS, CONFIRM_COPY, INSCRIERI_PENDING_COPY].flatMap(strings);

  it('has no em dash, no middle dot and the comma-below letters', () => {
    expect(all.length).toBeGreaterThan(60);
    expect(all.filter((s) => /[—·şţŞŢ]/.test(s))).toEqual([]);
  });

  it('quotes the spec word for word where it gives the text', () => {
    expect(LIST_COPY.searchPlaceholder).toBe('Caută după nr. înscriere, nume, părinte, email sau telefon...');
    expect(CONFIRM_COPY.pickHint).toBe('Alege "Sportiv existent" sau "Sportiv nou"');
    expect(CONFIRM_COPY.intent('1 ședință grup')).toBe('1 ședință grup, doar intenția părintelui; abonamentul se adaugă când e cumpărat');
    expect(PANEL_COPY.undoDialog).toEqual({
      title: 'Anulezi confirmarea?',
      message: 'Se anulează legătura cu fișa, grupa adăugată și statusul A.C.S. scris la confirmare.',
      confirm: 'Anulează confirmarea',
    });
  });
});
