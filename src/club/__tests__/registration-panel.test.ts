import { describe, expect, it } from 'vitest';
import {
  MISSING,
  emailStatusText,
  fileNameFrom,
  readEmailStatus,
  registrationDocumentKinds,
  failedEmailError,
  registrationPanelRows,
  requestErrorText,
  resendTarget,
  resendToast,
  type EmailStatus,
} from '../registration-panel';

const scriptForm = {
  registrationNumber: '2026-0142',
  childName: 'Ana Pop',
  childBirthDate: '2018-03-02',
  childHeight: 128,
  parentName: 'Maria Pop',
  relationship: 'alta',
  relationshipOther: 'Bunică',
  email: 'maria@example.com',
  phone: '0722 000 000',
  shirtSize: '128',
  lastSeason: 'Începători',
  membershipAnswer: 'da',
  subscriptionChoice: { priceItemName: 'Abonament 8 ședințe grup', price: 590, member: true },
  source: 'Altele',
  sourceOther: 'Ziar',
  gdprConsent: true,
  regulationsConsent: true,
  priorExperience: 'Nu este cazul',
  expectations: '',
};

const value = (rows: { label: string; value: string }[], label: string) => rows.find((r) => r.label === label)?.value;

describe('registrationPanelRows', () => {
  it('shows the script form answers of a new registration, read-only', () => {
    const { rows, longRows } = registrationPanelRows(scriptForm);
    expect(rows[0]).toEqual({ label: 'Nr. înscriere', value: '2026-0142' });
    expect(value(rows, 'Calitate')).toBe('Bunică');
    expect(value(rows, 'Înălțime')).toBe('128 cm');
    expect(value(rows, 'Membru A.C.S.')).toBe('Da');
    expect(value(rows, 'Abonament')).toBe('Abonament 8 ședințe grup, 590 RON');
    expect(value(rows, 'Cum a aflat')).toBe('Altele: Ziar');
    expect(value(rows, 'Acord GDPR')).toBe('Da');
    expect(value(rows, 'Nivel')).toBeUndefined();
    expect(longRows).toEqual([
      { label: 'Experiență anterioară', value: 'Nu este cazul' },
      { label: 'Așteptări', value: MISSING },
    ]);
  });

  it('uses the option label for Părinte / Tutore Legal', () => {
    expect(value(registrationPanelRows({ ...scriptForm, relationship: 'tutore' }).rows, 'Calitate')).toBe('Tutore Legal');
  });

  it('keeps the old fields for registrations sent before phase 2', () => {
    const { rows } = registrationPanelRows({ childName: 'Ion', level: 'Avansati', howHeard: 'Facebook', clubInterest: true });
    expect(rows.map((r) => r.label)).toEqual([
      'Data nașterii', 'Nume părinte', 'Email', 'Telefon', 'Mărime tricou', 'Cum a aflat', 'Nivel',
      'Interes club', 'Acord regulament', 'Acord confidențialitate',
    ]);
    expect(value(rows, 'Nivel')).toBe('Avansati');
    expect(value(rows, 'Email')).toBe(MISSING);
  });
});

const status = (patch: Partial<EmailStatus>): EmailStatus => ({
  status: 'sent',
  recipient: 'maria@example.com',
  attempts: 1,
  lastError: null,
  sentAt: '2026-10-20T11:05:00.000Z',
  updatedAt: '2026-10-20T11:05:00.000Z',
  documents: ['Pop_Ana_Acord_2026-2027.pdf'],
  ...patch,
});

describe('documents and e-mail', () => {
  it('a member answer adds the Cerere de adeziune', () => {
    expect(registrationDocumentKinds(scriptForm)).toEqual(['acord', 'adeziune']);
    expect(registrationDocumentKinds({ ...scriptForm, membershipAnswer: 'nu' })).toEqual(['acord']);
  });

  it("reads 2F's status answer and ignores anything else", () => {
    expect(readEmailStatus({ ok: true, data: { ...status({}), documents: ['Pop_Ana_Acord_2026-2027.pdf', 3] } })).toEqual(status({}));
    expect(readEmailStatus({ ok: true, data: { status: 'none', recipient: 'maria@example.com', attempts: 0, documents: [] } })).toMatchObject({ status: 'none' });
    expect(readEmailStatus({ ok: false, code: 'not-found', error: 'x' })).toBeNull();
    expect(readEmailStatus({ data: { status: 'lost' } })).toBeNull();
  });

  it('describes the status tersely', () => {
    const fmt = () => '20 oct 2026, 14:05';
    expect(emailStatusText(null, fmt)).toBe('Niciun e-mail');
    expect(emailStatusText(status({ status: 'none' }), fmt)).toBe('Niciun e-mail');
    expect(emailStatusText(status({}), fmt)).toBe('Trimis 20 oct 2026, 14:05');
    expect(emailStatusText(status({ status: 'queued', sentAt: null }), fmt)).toBe('În coadă');
    expect(emailStatusText(status({ status: 'failed', sentAt: null }), fmt)).toBe('Netrimis');
  });

  it('the resend confirmation names the recipient and the documents', () => {
    expect(resendTarget(null, scriptForm)).toEqual({ recipient: 'maria@example.com', documents: ['Acord', 'Cerere de adeziune'] });
    expect(resendTarget(status({ recipient: 'alt@example.com' }), scriptForm)).toEqual({
      recipient: 'alt@example.com',
      documents: ['Pop_Ana_Acord_2026-2027.pdf'],
    });
    expect(resendTarget(status({ status: 'none', recipient: '', documents: [] }), { ...scriptForm, membershipAnswer: 'nu' })).toEqual({
      recipient: 'maria@example.com',
      documents: ['Acord'],
    });
  });

  it("the resend toast follows 2F's status, and a failure shows its reason in the panel", () => {
    expect(resendToast(status({}))).toEqual({ tone: 'success', text: 'E-mail trimis.' });
    expect(resendToast(status({ status: 'queued', sentAt: null }))).toEqual({ tone: 'info', text: 'E-mailul va fi trimis în curând.' });
    expect(resendToast(status({ status: 'failed', sentAt: null, lastError: 'Brevo 401' }))).toEqual({ tone: 'error', text: 'Trimiterea a eșuat.' });
    expect(resendToast(null)).toEqual({ tone: 'info', text: 'E-mailul va fi trimis în curând.' });
    expect(failedEmailError(status({ status: 'failed', sentAt: null, lastError: 'Brevo 401' }))).toBe('Brevo 401');
    expect(failedEmailError(status({ status: 'queued', sentAt: null, lastError: 'Brevo 401' }))).toBeNull();
    expect(failedEmailError(null)).toBeNull();
  });

  it("shows the server's refusal text, in Strapi's shape or 2F's", () => {
    expect(requestErrorText({ response: { data: { ok: false, code: 'no-documents', error: 'Înscrierea nu are documente.' } } }, 'x')).toBe('Înscrierea nu are documente.');
    expect(requestErrorText({ response: { data: { error: { message: 'Nu.' } } } }, 'x')).toBe('Nu.');
    expect(requestErrorText(new Error('Request failed'), 'Nu am putut.')).toBe('Nu am putut.');
  });

  it('takes the PDF file name from the response header', () => {
    expect(fileNameFrom('attachment; filename="Pop_Ana_Acord_2026-2027.pdf"', 'acord.pdf')).toBe('Pop_Ana_Acord_2026-2027.pdf');
    expect(fileNameFrom("attachment; filename*=UTF-8''Acord%20gol.pdf", 'acord.pdf')).toBe('Acord gol.pdf');
    expect(fileNameFrom(null, 'acord.pdf')).toBe('acord.pdf');
  });
});
