import { describe, expect, it } from 'vitest';
import {
  RELATIONSHIP_EDIT_OPTIONS,
  emailPanelState,
  emailStatusText,
  fileNameFrom,
  formatEmailSentAt,
  readEmailStatus,
  registrationDocumentKinds,
  failedEmailError,
  relationshipText,
  requestErrorText,
  resendTarget,
  resendToast,
  sourceText,
  subscriptionText,
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

describe('answer texts (shared by the panel tabs, the Sheet and the history)', () => {
  it('Calitate, the subscription choice and the source as the panel shows them', () => {
    expect(relationshipText(scriptForm)).toBe('Bunică');
    expect(relationshipText({ ...scriptForm, relationship: 'tutore' })).toBe('Tutore Legal');
    expect(relationshipText({})).toBe('');
    expect(subscriptionText(scriptForm.subscriptionChoice)).toBe('Abonament 8 ședințe grup, 590 RON');
    expect(sourceText(scriptForm)).toBe('Altele: Ziar');
  });

  it('Calitate options of "Editează"', () => {
    expect(RELATIONSHIP_EDIT_OPTIONS).toEqual([
      { value: 'parinte', label: 'Părinte' },
      { value: 'tutore', label: 'Tutore Legal' },
      { value: 'alta', label: 'Alta' },
    ]);
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
    expect(emailStatusText(null, fmt)).toBe('Niciun e-mail trimis');
    expect(emailStatusText(status({ status: 'none' }), fmt)).toBe('Niciun e-mail trimis');
    expect(emailStatusText(status({}), fmt)).toBe('Trimis 20 oct 2026, 14:05');
    expect(emailStatusText(status({ status: 'queued', sentAt: null }), fmt)).toBe('Urmează să fie trimis');
    expect(emailStatusText(status({ status: 'failed', sentAt: null }), fmt)).toBe('Netrimis');
  });

  it('formats the sent date for the panel and the Sheet, in Bucharest time, summer and winter', () => {
    expect(formatEmailSentAt('2026-10-24T08:31:00.000Z')).toBe('24.10.2026, 11:31');
    expect(formatEmailSentAt('2026-12-01T12:05:00.000Z')).toBe('01.12.2026, 14:05');
    expect(formatEmailSentAt('not-a-date')).toBe('');
  });

  it('shows a spinner while loading, the reload prompt after a failed GET, else the status', () => {
    expect(emailPanelState(false, false)).toBe('loading');
    expect(emailPanelState(true, true)).toBe('load-failed');
    expect(emailPanelState(true, false)).toBe('ready');
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

  it("the resend toast follows 2F's status, and a failure shows the retry hint, not the technical reason", () => {
    expect(resendToast(status({}))).toEqual({ tone: 'success', text: 'E-mail trimis.' });
    expect(resendToast(status({ status: 'queued', sentAt: null }))).toEqual({ tone: 'info', text: 'Urmează să fie trimis.' });
    expect(resendToast(status({ status: 'failed', sentAt: null, lastError: 'Brevo 401' }))).toEqual({ tone: 'error', text: 'Nu s-a putut trimite.' });
    expect(resendToast(null)).toEqual({ tone: 'info', text: 'Urmează să fie trimis.' });
    expect(failedEmailError(status({ status: 'failed', sentAt: null, lastError: 'Brevo 401' }))).toBe('Apasă Retrimite sau verifică adresa.');
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
