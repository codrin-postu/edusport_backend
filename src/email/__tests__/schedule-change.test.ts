import { describe, expect, it } from 'vitest';
import type { ScheduleChangePayload } from '../../club/groups/types';
import { attemptJob, type EmailDeps, type EmailJobRow } from '../email-jobs';
import { isDue } from '../job-state';
import { renderScheduleEmail, scheduleParagraphs, scheduleSubject } from '../schedule-change-template';

const CANCEL: ScheduleChangePayload = {
  groupName: 'Primii Pași', date: '2026-11-14', startTime: '10:00', mode: 'cancel', newDate: null, newStartTime: null,
  nextDate: '2026-11-15', nextStartTime: '10:00', reason: 'Competiție la Brașov',
};
const MOVE: ScheduleChangePayload = { ...CANCEL, mode: 'move', newDate: '2026-11-15', newStartTime: '12:00', nextDate: null, nextStartTime: null, reason: 'Patinoarul este închis.' };
const LINKS = { site: 'https://scoaladepatinaj.ro', program: 'https://scoaladepatinaj.ro/cursuri/program', privacy: 'https://scoaladepatinaj.ro/protectia-datelor', headerImage: null, whatsapp: null, phone: null, email: null, facebook: null };

describe('approved texts (6.5)', () => {
  it('subjects', () => {
    expect(scheduleSubject(CANCEL)).toBe('Primii Pași: ședința de sâmbătă, 14 noiembrie, se anulează');
    expect(scheduleSubject(MOVE)).toBe('Primii Pași: ședința de sâmbătă, 14 noiembrie, se mută');
  });

  it('cancel body, paragraphs in order, Motiv on the next line of the same paragraph', () => {
    expect(scheduleParagraphs(CANCEL)).toEqual([
      ['Bună ziua,'],
      ['Ședința grupei Primii Pași de sâmbătă, 14 noiembrie, ora 10:00, se anulează.', 'Motiv: Competiție la Brașov.'],
      ['Următoarea ședință: duminică, 15 noiembrie, ora 10:00.'],
      ['Echipa EduSport'],
    ]);
  });

  it('move body; a reason ending in a period gets no second one; no reason, no Motiv; no next class, no line (W33)', () => {
    expect(scheduleParagraphs(MOVE)[1]).toEqual(['Ședința grupei Primii Pași de sâmbătă, 14 noiembrie, ora 10:00, se mută duminică, 15 noiembrie, ora 12:00.', 'Motiv: Patinoarul este închis.']);
    expect(scheduleParagraphs({ ...CANCEL, reason: null, nextDate: null, nextStartTime: null })).toEqual([
      ['Bună ziua,'], ['Ședința grupei Primii Pași de sâmbătă, 14 noiembrie, ora 10:00, se anulează.'], ['Echipa EduSport'],
    ]);
  });

  it('renders the E1 letter with escaped text and a plain-text part', () => {
    const mail = renderScheduleEmail({ payload: { ...CANCEL, groupName: 'A <b>' }, links: LINKS });
    expect(mail.html).toContain('A &lt;b&gt;');
    expect(mail.html).toContain('Politicii de Confidențialitate');
    expect(mail.text.startsWith('Bună ziua,\n\nȘedința grupei A <b> de sâmbătă')).toBe(true);
  });
});

const job = (over: Partial<EmailJobRow> = {}): EmailJobRow => ({
  documentId: 'j1', recipient: 'parinte@example.com', subject: 's', registrationDocumentId: null, status: 'queued', attempts: 0, lastError: null, sentAt: null,
  updatedAt: '2026-11-20T10:00:00.000Z', kind: 'schedule-change', payload: CANCEL, notBefore: '2026-11-20T10:00:15.000Z', ...over,
});

function deps(now: string, sent: string[]): EmailDeps {
  const config = { live: false, apiKey: 'k', sender: { email: 'scoala@example.com', name: 'Școala' }, replyTo: null, testRecipient: 'test@example.com', siteUrl: 'https://scoaladepatinaj.ro' };
  return {
    config: config as EmailDeps['config'],
    jobs: { create: async () => job(), update: async (_id, data) => job(data), findQueued: async () => [], findLatest: async () => null, countForRecipientSince: async () => 0 },
    loadRegistration: async () => null, listDocuments: async () => [], buildDocuments: async () => [], readDocument: async () => Buffer.from(''),
    loadLinks: async () => LINKS,
    send: async (m) => { sent.push(`${m.to}|${m.subject}`); return { ok: true, messageId: null }; },
    recordHistory: async () => undefined, alert: () => undefined, log: () => undefined, defer: () => undefined, now: () => new Date(now),
  };
}

describe('queue (3.6, W7)', () => {
  it('waits until notBefore, then sends to the test address outside production', async () => {
    const sent: string[] = [];
    expect((await attemptJob(deps('2026-11-20T10:00:10.000Z', sent), job())).status).toBe('queued');
    expect(sent).toEqual([]);
    expect((await attemptJob(deps('2026-11-20T10:00:16.000Z', sent), job())).status).toBe('sent');
    expect(sent).toEqual(['test@example.com|Primii Pași: ședința de sâmbătă, 14 noiembrie, se anulează']);
  });

  it('a cancelled job is never sent; the cron skips a held job', async () => {
    const sent: string[] = [];
    await attemptJob(deps('2026-11-20T11:00:00.000Z', sent), job({ status: 'cancelled' }));
    expect(sent).toEqual([]);
    expect(isDue({ status: 'queued', updatedAt: '2026-11-20T09:00:00.000Z', notBefore: '2026-11-20T12:00:00.000Z' }, new Date('2026-11-20T11:00:00.000Z'), 0)).toBe(false);
  });

  it('a cancel that landed after the snapshot wins: nothing is sent', async () => {
    const sent: string[] = [];
    const d = deps('2026-11-20T10:00:16.000Z', sent);
    d.jobs.findById = async () => job({ status: 'cancelled' });
    expect((await attemptJob(d, job())).status).toBe('cancelled');
    expect(sent).toEqual([]);
  });

  it('no start time, or a move without its new time, fails at once instead of a broken sentence', async () => {
    const sent: string[] = [];
    const late = deps('2026-11-20T11:00:00.000Z', sent);
    expect((await attemptJob(late, job({ payload: { ...CANCEL, startTime: '' } }))).status).toBe('failed');
    expect((await attemptJob(late, job({ payload: { ...MOVE, newStartTime: null } }))).status).toBe('failed');
    expect(sent).toEqual([]);
  });

  it('a schedule change without a payload fails at once', async () => {
    expect((await attemptJob(deps('2026-11-20T11:00:00.000Z', []), job({ payload: null }))).status).toBe('failed');
  });
});
