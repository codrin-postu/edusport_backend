import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { emailStatusCell } from '../../../email/sheet-status';
import { ATHLETE_STATUSES } from '../../athlete-data';
import { HISTORY_ACTIONS, STATUS_WORDS, SUBJECT, historyTexts } from '../../history-text';
import { emailStatusText, readEmailStatus } from '../../registration-panel';
import { countWords } from '../../ro-count';
import { PERSONAL_DATA_COPY as C } from '../copy';

const API = join(__dirname, '..', '..', '..', 'api');
const schema = (name: string) => JSON.parse(readFileSync(join(API, name, 'content-types', name, 'schema.json'), 'utf8'));

describe('3C data (spec 2)', () => {
  it('athlete: status "anonimizat" and the time of the anonymization', () => {
    const a = schema('athlete').attributes;
    expect(a.status.enum).toEqual(['nou', 'activ', 'inactiv', 'anonimizat']);
    expect(a.anonymizedAt).toEqual({ type: 'datetime' });
    expect(ATHLETE_STATUSES).toEqual(['nou', 'activ', 'inactiv', 'anonimizat']);
    expect(STATUS_WORDS.anonimizat).toBe('Anonimizat');
  });

  it('site settings hold personalData; an e-mail job can be cancelled', () => {
    expect(schema('site-settings').attributes.personalData).toEqual({ type: 'json' });
    expect(schema('email-job').attributes.status.enum).toEqual(['queued', 'sending', 'sent', 'failed', 'cancelled']);
  });

  it('registrations and history entries keep their schema', () => {
    expect(schema('registration-submission').attributes.email).toMatchObject({ type: 'string', required: true });
    expect(schema('history-entry').attributes.changes).toEqual({ type: 'json' });
  });
});

describe('Istoric lines without personal data (spec 2)', () => {
  it('"Date exportate" and "Date anonimizate"', () => {
    expect(historyTexts(HISTORY_ACTIONS.dataExported, {}, SUBJECT.athlete)).toEqual(['Date exportate']);
    expect(historyTexts(HISTORY_ACTIONS.dataAnonymized, {}, SUBJECT.athlete)).toEqual(['Date anonimizate']);
  });
});

describe('a cancelled e-mail job (spec 4)', () => {
  it('reads "Netrimis" in the panel and in the Sheet', () => {
    const status = readEmailStatus({ data: { status: 'cancelled', recipient: '', attempts: 0, documents: [] } });
    expect(status?.status).toBe('cancelled');
    expect(emailStatusText(status, () => '')).toBe('Netrimis');
    expect(emailStatusCell([{ status: 'cancelled', createdAt: '2026-10-27T10:00:00.000Z' }])).toBe('Netrimis');
  });
});

describe('3C copy (spec 4, 5, 7)', () => {
  it('counts take "de" from 20 (shared with the Sportivi list)', () => {
    expect(countWords(1, 'sportiv', 'sportivi')).toBe('1 sportiv');
    expect(countWords(20, 'sportiv', 'sportivi')).toBe('20 de sportivi');
    expect(countWords(101, 'sportiv', 'sportivi')).toBe('101 sportivi');
  });

  it('the confirmation is the spec text', () => {
    expect(C.dialog.title).toBe('Anonimizezi datele sportivului?');
    expect(C.dialog.removed).toBe(
      'Se șterg: numele, data nașterii, contactul, telefonul, e-mailul, notele, datele din înscrieri, documentele PDF, adresele din coada de e-mail, valorile vechi din Istoric și profilul public.',
    );
    expect(C.dialog.kept).toBe('Rămân: grupele pe sezoane, statusul A.C.S. și numărul de înscrieri.');
    expect(C.dialog.final).toBe('Acțiunea nu poate fi anulată.');
    expect(C.dialog.confirm).toBe('Anonimizează');
  });

  it('notice, filter option, bulk title, button and toasts', () => {
    expect(C.notice(3, 5)).toBe('3 sportivi inactivi de peste 5 ani.');
    expect(C.notice(1, 1)).toBe('1 sportiv inactiv de peste 1 an.');
    expect(C.notice(20, 20)).toBe('20 de sportivi inactivi de peste 20 de ani.');
    expect(C.inactiveOption(5)).toBe('Inactivi de peste 5 ani');
    expect(C.bulkTitle(4)).toBe('Anonimizezi datele pentru 4 sportivi?');
    expect(C.bulkButton(4)).toBe('Anonimizează (4)');
    expect(C.done(1)).toBe('1 sportiv anonimizat.');
    expect(C.done(4)).toBe('4 sportivi anonimizați.');
    expect(C.skipped(2)).toBe('Sărite: 2.');
    expect(C.failed(1)).toBe('Nereușite: 1.');
  });

  it('no em dash, middle dot, curly quotes or s/t with cedilla anywhere', () => {
    const texts = [JSON.stringify(C), C.notice(3, 5), C.bulkTitle(2), C.done(2), C.inactiveOption(5), C.pdf.generated('27.10.2026, 12:00', 'Ana')];
    for (const text of texts) expect(text).not.toMatch(/[—·„“”şţŞŢ]/);
  });
});
