import type { EmailDeps, EmailJobRow } from '../email-jobs';
import type { EmailLinks } from '../registration-template';

export const LINKS: EmailLinks = {
  site: 'https://scoaladepatinaj.ro', program: 'https://scoaladepatinaj.ro/cursuri/program', privacy: 'https://scoaladepatinaj.ro/protectia-datelor',
  headerImage: null, whatsapp: null, phone: null, email: null, facebook: null,
};

export const queuedJob = (over: Partial<EmailJobRow> = {}): EmailJobRow => ({
  documentId: 'j1', recipient: 'parinte@example.com', subject: 's', registrationDocumentId: null, status: 'queued', attempts: 0, lastError: null, sentAt: null,
  updatedAt: '2026-11-20T10:00:00.000Z', kind: 'registration', payload: null, notBefore: null, ...over,
});

export type FakeDeps = EmailDeps & { sent: { to: string; subject: string }[]; onSentCalls: (string | null | undefined)[]; stored: { row: EmailJobRow } };

/** One stored job behind the whole store contract (claim, finish), an `onSent` spy and a recording `send`. */
export function fakeDeps(opts: { onSent?: EmailDeps['onSent'] } = {}): FakeDeps {
  const stored = { row: queuedJob() };
  const sent: FakeDeps['sent'] = [];
  const onSentCalls: FakeDeps['onSentCalls'] = [];
  const config = { live: false, apiKey: 'k', sender: { email: 'scoala@example.com', name: 'Școala' }, replyTo: null, testRecipient: 'test@example.com', siteUrl: 'https://scoaladepatinaj.ro' };
  return {
    config: config as EmailDeps['config'],
    jobs: {
      create: async () => stored.row,
      update: async (_id, data) => (stored.row = { ...stored.row, ...data }),
      findById: async () => stored.row,
      claim: async () => {
        if (stored.row.status !== 'queued') return false;
        stored.row = { ...stored.row, status: 'sending' };
        return true;
      },
      finish: async (_id, data) => (stored.row.status === 'sending' ? (stored.row = { ...stored.row, ...data }) : null),
      failStuck: async () => 0, findQueued: async () => [], findLatest: async () => null, countForRecipientSince: async () => 0,
    },
    loadRegistration: async () => null, listDocuments: async () => [], buildDocuments: async () => [], readDocument: async () => Buffer.from(''),
    loadLinks: async () => LINKS,
    send: async (m) => { sent.push({ to: m.to, subject: m.subject }); return { ok: true, messageId: null }; },
    recordHistory: async () => undefined, alert: () => undefined, log: () => undefined, defer: () => undefined, now: () => new Date('2026-11-20T10:00:00.000Z'),
    onSent: async (job) => { onSentCalls.push(job.paymentDocumentId); await opts.onSent?.(job); },
    sent, onSentCalls, stored,
  };
}
