import { describe, expect, it } from 'vitest';
import { fakePresenceContext } from '../../club/presence/__tests__/fake-store';
import { attemptJob } from '../email-jobs';
import { isPaymentPayload, paymentEmailJob, paymentParagraphs, renderPaymentEmail } from '../payment-email';
import { toJobRow } from '../strapi-email';
import { fakeDeps, LINKS, queuedJob } from './helpers';

const payload = { athleteName: 'Ana Ionescu', amount: 320, method: 'numerar' as const, paidOn: '2026-10-27', purposeText: 'Abonament 8 ședințe' };
const paymentJob = (over = {}) => queuedJob({ kind: 'payment', registrationDocumentId: null, paymentDocumentId: 'p1', payload, ...over });

describe('"Plată înregistrată" e-mail', () => {
  it('subject and paragraphs as approved (9, p5 Q42)', () => {
    expect(paymentParagraphs(payload)).toEqual([['Bună ziua,'], ['Am înregistrat plata de 320 RON pentru Ana Ionescu.'],
      ['Pentru: Abonament 8 ședințe. Metodă: Numerar. Data: 27 oct 2026.'], ['Acesta nu este un document fiscal.'], ['Echipa EduSport']]);
    const r = renderPaymentEmail({ payload, links: LINKS });
    expect(r.subject).toBe('Plată înregistrată: Ana Ionescu');
    expect(r.text).toContain('Am înregistrat plata de 320 RON pentru Ana Ionescu.');
    expect(r.html).toContain('Acesta nu este un document fiscal.');
  });
  it('escapes the names and shows cents', () => {
    const r = renderPaymentEmail({ payload: { ...payload, athleteName: 'A <b>', amount: 12.5 }, links: LINKS });
    expect(r.html).toContain('A &lt;b&gt;');
    expect(r.text).toContain('plata de 12,50 RON pentru A <b>.');
  });
  it('a job held 15 s, address trimmed and lower case (3.7, 9)', () => {
    expect(paymentEmailJob({ recipient: ' Ana@Example.com ', paymentId: 'p1', payload }, new Date('2026-10-27T10:00:00.000Z')))
      .toEqual({ recipient: 'ana@example.com', subject: 'Plată înregistrată: Ana Ionescu', paymentId: 'p1', notBefore: '2026-10-27T10:00:15.000Z', payload });
  });
  it('payload check', () => {
    expect(isPaymentPayload(payload)).toBe(true);
    expect(isPaymentPayload({ ...payload, amount: '320' })).toBe(false);
    expect(isPaymentPayload({ ...payload, paidOn: '27.10.2026' })).toBe(false);
    expect(isPaymentPayload({ ...payload, method: 'toString' })).toBe(false);
    expect(isPaymentPayload(null)).toBe(false);
  });
  it('the queue sends a payment job with the payment letter and calls onSent once (email-jobs)', async () => {
    const deps = fakeDeps();
    deps.stored.row = paymentJob();
    expect((await attemptJob(deps, paymentJob())).status).toBe('sent');
    expect(deps.sent).toEqual([{ to: 'test@example.com', subject: 'Plată înregistrată: Ana Ionescu' }]);
    expect(deps.onSentCalls).toEqual(['p1']);
  });
  it('a payment job without a valid payload fails without sending', async () => {
    const deps = fakeDeps();
    const row = await attemptJob(deps, paymentJob({ payload: null }));
    expect(row).toMatchObject({ status: 'failed', lastError: 'payment without payload' });
    expect(deps.sent).toEqual([]);
    expect(deps.onSentCalls).toEqual([]);
  });
  it('a throwing onSent is logged and never fails the attempt', async () => {
    const logs: string[] = [];
    const deps = fakeDeps({ onSent: async () => { throw new Error('history down'); } });
    deps.stored.row = paymentJob();
    deps.log = (_level, m) => logs.push(m);
    expect((await attemptJob(deps, paymentJob())).status).toBe('sent');
    expect(logs.some((m) => m.includes('onSent') && m.includes('history down'))).toBe(true);
  });
  it('a held job is not sent and onSent is not called', async () => {
    const deps = fakeDeps();
    expect((await attemptJob(deps, paymentJob({ notBefore: '2026-11-20T10:00:15.000Z' }))).status).toBe('queued');
    expect(deps.sent).toEqual([]);
    expect(deps.onSentCalls).toEqual([]);
  });
  it('the job row knows the payment kind and link; the cron never reads a payment as a registration', () => {
    expect(toJobRow({ documentId: 'j', kind: 'payment', payload, payment: { documentId: 'p1' } })).toMatchObject({ kind: 'payment', paymentDocumentId: 'p1', payload });
    expect(toJobRow({ documentId: 'j', kind: 'payment', payload: { ...payload, amount: 'x' }, payment: { documentId: 'p1' } })).toMatchObject({ kind: 'payment', payload: null });
    expect(toJobRow({ documentId: 'j', kind: 'registration', payload: null })).toMatchObject({ kind: 'registration', paymentDocumentId: null });
  });
  it('the fake context records the e-mails asked after commit', () => {
    const f = fakePresenceContext({});
    f.ctx.paymentEmails('p1');
    expect(f.emailsAfter).toEqual(['p1']);
  });
});
