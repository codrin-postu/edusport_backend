import { describe, expect, it } from 'vitest';
import { acsWord } from '../acs';
import { HISTORY_ACTIONS as A, PENDING_COPY, SUBJECT, actorLabel, historyTexts } from '../history-text';

const reg = (action: string, changes?: unknown) => historyTexts(action, changes, SUBJECT.registration);
const ath = (action: string, changes?: unknown) => historyTexts(action, changes, SUBJECT.athlete);

describe('registration lines (spec 1.6)', () => {
  it('submit, rebuild, resend', () => {
    expect(reg(A.submitted)).toEqual(['Înscriere înregistrată']);
    expect(reg(A.documentRebuilt, { documents: ['acord'] })).toEqual(['Document refăcut']);
    expect(reg(A.emailResent, { recipient: 'ana@example.com', documents: [] })).toEqual(['E-mail retrimis către ana@example.com']);
  });

  it('one line per edited field, with the form wording, old -> new, blanks blank', () => {
    expect(reg(A.updated, { fields: { phone: { from: '0722 111 22', to: '0722 111 222' }, relationship: { from: 'parinte', to: 'alta' }, membershipAnswer: { from: null, to: 'da' } } })).toEqual([
      'Telefon de contact: "0722 111 22" → "0722 111 222"',
      'Calitatea față de sportiv: "Părinte" → "Alta"',
      'Dorește să fie membru: "" → "Da"',
    ]);
  });

  it('reads the old migration rows', () => {
    expect(reg(A.updated, { season: { from: '2025–2026', to: '2025-2026' }, seasonRef: 'x' })).toEqual(['Sezon: "2025–2026" → "2025-2026"']);
    expect(reg(A.numberAssigned, { registrationNumber: '2026-0001' })).toEqual(['Nr. înscriere: "" → "2026-0001"']);
  });

  it('confirmation lines (proto v5)', () => {
    expect(reg(A.confirmed, { athleteName: 'Maria Pop', createdAthlete: false, groupName: 'Intermediari Bronze' })).toEqual([
      'Confirmat. Fișa existentă folosită (Maria Pop); grupa Intermediari Bronze.',
    ]);
    expect(reg(A.confirmed, { athleteName: 'Maria Pop', createdAthlete: true, groupName: null })).toEqual(['Confirmat. Sportiv nou creat; fără grupă.']);
    expect(reg(A.confirmationUndone)).toEqual(['Confirmare anulată']);
    expect(reg(A.schoolMoved, { schoolName: 'Patinoar 2' })).toEqual(['Mutată la Patinoar 2']);
  });

  it('archive uses the pending label (N2 c)', () => {
    expect(reg(A.updated, { fields: { archived: { from: false, to: true } } })).toEqual([`${PENDING_COPY.archivedLabel}: "Nu" → "Da"`]);
  });

  it('drops the brackets when the existing athlete has no name', () => {
    expect(reg(A.confirmed, { athleteName: '', createdAthlete: false, groupName: null })).toEqual(['Confirmat. Fișa existentă folosită; fără grupă.']);
    expect(reg(A.confirmed, { createdAthlete: false, groupName: 'Intermediari Bronze' })).toEqual(['Confirmat. Fișa existentă folosită; grupa Intermediari Bronze.']);
  });

  it('relationship and relationshipOther render as one line, "Alta: <text>"', () => {
    expect(reg(A.updated, { fields: { relationship: { from: 'parinte', to: 'alta' }, relationshipOther: { from: null, to: 'Bunica' } } })).toEqual([
      'Calitatea față de sportiv: "Părinte" → "Alta: Bunica"',
    ]);
    expect(reg(A.updated, { fields: { relationshipOther: { from: 'Bunica', to: 'Matusa' } } })).toEqual([
      'Calitatea față de sportiv: "Alta: Bunica" → "Alta: Matusa"',
    ]);
    expect(reg(A.updated, { fields: { relationship: { from: 'alta', to: 'parinte' }, relationshipOther: { from: 'Bunica', to: null } } })).toEqual([
      'Calitatea față de sportiv: "Alta: Bunica" → "Părinte"',
    ]);
  });
});

describe('athlete lines (spec 1.6)', () => {
  it('creation', () => {
    expect(ath(A.created, { firstName: 'Maria', publicProfile: 'p1' })).toEqual(['Fișă creată din profilul public existent']);
    expect(ath(A.createdFromProfile, { publicProfile: 'p1' })).toEqual(['Fișă creată din profilul public existent']);
    expect(ath(A.createdFromRegistrations, { registrations: [] })).toEqual(['Fișă creată din înscrierile anterioare']);
    expect(ath(A.created, { fields: {} })).toEqual([PENDING_COPY.athleteCreated]);
  });

  it('confirmation and what it wrote', () => {
    expect(ath(A.registrationConfirmed, { registrationNumber: '2026-0142', groupName: 'Primii Pași' })).toEqual(['Înscriere confirmată: 2026-0142, grupa Primii Pași']);
    expect(ath(A.registrationConfirmed, { registrationNumber: '2026-0142', groupName: null })).toEqual(['Înscriere confirmată: 2026-0142']);
    expect(ath(A.updated, { fields: { phone: { from: '0722 111 22', to: '0722 111 222' } }, registrationNumber: '2026-0142' })).toEqual([
      'Telefon: "0722 111 22" → "0722 111 222" (din înscrierea 2026-0142)',
    ]);
    expect(ath(A.groupAdded, { groupName: 'Primii Pași' })).toEqual(['Adăugat în grupa Primii Pași']);
    expect(ath(A.acsChanged, { season: '2026-2027', from: null, to: 'in_asteptare' })).toEqual(['Membru A.C.S. 2026-2027: Nu → În așteptare']);
    expect(ath(A.reactivated)).toEqual(['Reactivat']);
  });

  it('edits, status, profile, merge, delete', () => {
    expect(ath(A.updated, { fields: { birthDate: { from: null, to: '2016-03-14' } } })).toEqual(['Data nașterii: "" → "14.03.2016"']);
    expect(ath(A.statusChanged, { from: 'activ', to: 'inactiv' })).toEqual(['Status: Activ → Inactiv']);
    expect(ath(A.registrationDeleted, { registrationNumber: '2026-0142' })).toEqual(['Înscriere ștearsă: 2026-0142']);
    expect(ath(A.profileCreated)).toEqual(['Profil public creat']);
    expect(ath(A.profilePage, { on: true })).toEqual(['Pagina publică pornită']);
    expect(ath(A.profilePage, { on: false })).toEqual(['Pagina publică oprită']);
    expect(ath(A.merged, { name: 'Maria D.' })).toEqual(['Unit cu Maria D.']);
    expect(ath(A.deleted, { name: 'Maria D.' })).toEqual(['Sportiv șters: Maria D.']);
    expect(ath(A.duplicateDismissed, { name: 'Maria D.' })).toEqual([PENDING_COPY.duplicateDismissed('Maria D.')]);
  });

  it('shows nothing for an unknown action', () => expect(ath('price-notes-updated', {})).toEqual([]));
});

describe('actor (3b Q23)', () => {
  it('by name, e-mail when no name, Migrare for the migration', () => {
    expect(actorLabel('ana@club.ro', { 'ana@club.ro': 'Ana Pop' })).toBe('Ana Pop');
    expect(actorLabel('ion@club.ro', {})).toBe('ion@club.ro');
    expect(actorLabel('migrare', {})).toBe('Migrare');
    expect(actorLabel('formular', {})).toBe(PENDING_COPY.formActor);
  });
});

describe('A.C.S. words', () => {
  it('no value reads as Nu', () => {
    expect(acsWord('da')).toBe('Da');
    expect(acsWord('in_asteptare')).toBe('În așteptare');
    expect(acsWord(null)).toBe('Nu');
  });
});
