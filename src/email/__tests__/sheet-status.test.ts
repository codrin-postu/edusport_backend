import { describe, expect, it } from 'vitest';
import type { EmailJobRow, EmailJobStore } from '../email-jobs';
import { emailStatusCell, sentAtLabel, sheetSyncedStore } from '../sheet-status';

describe('the Sheet "E-mail" cell', () => {
  it('prints the sending time in Bucharest time, summer and winter', () => {
    expect(sentAtLabel('2026-10-03T11:23:00.000Z')).toBe('03.10.2026, 14:23');
    expect(sentAtLabel('2026-12-01T12:05:00.000Z')).toBe('01.12.2026, 14:05');
    expect(sentAtLabel(new Date('2027-01-31T22:30:00.000Z'))).toBe('01.02.2027, 00:30');
  });

  it('shows the newest job: sent, queued or failed', () => {
    const sent = { status: 'sent', sentAt: '2026-10-03T11:23:00.000Z', createdAt: '2026-10-03T11:22:58.000Z' };
    expect(emailStatusCell([sent])).toBe('Trimis 03.10.2026, 14:23');
    expect(emailStatusCell([{ status: 'queued', createdAt: '2026-10-03T11:22:58.000Z' }])).toBe('Urmează să fie trimis');
    expect(emailStatusCell([{ status: 'failed', createdAt: '2026-10-03T11:22:58.000Z' }])).toBe('Netrimis');
    const resent = { status: 'queued', createdAt: '2026-10-05T08:00:00.000Z' };
    expect(emailStatusCell([resent, sent])).toBe('Urmează să fie trimis');
    expect(emailStatusCell([sent, { status: 'failed', createdAt: '2026-10-01T08:00:00.000Z' }])).toBe('Trimis 03.10.2026, 14:23');
  });

  it('shows "Niciun e-mail trimis" without a job', () => {
    expect(emailStatusCell([])).toBe('Niciun e-mail trimis');
    expect(emailStatusCell(undefined)).toBe('Niciun e-mail trimis');
    expect(emailStatusCell(null)).toBe('Niciun e-mail trimis');
  });
});

describe('sheetSyncedStore', () => {
  const row = (over: Partial<EmailJobRow> = {}): EmailJobRow => ({
    documentId: 'job-1', recipient: 'p@example.ro', subject: 's', registrationDocumentId: 'reg-1',
    status: 'queued', attempts: 0, lastError: null, sentAt: null, updatedAt: null, ...over,
  });
  const base: EmailJobStore = {
    create: async (job) => row({ registrationDocumentId: job.registrationDocumentId }),
    update: async (documentId, data) => row({ documentId, ...data }),
    findQueued: async () => [row()],
    findLatest: async () => row(),
    countForRecipientSince: async () => 0,
  };

  it('refreshes the registration row in the Sheet when a job is created or changes status', async () => {
    const refreshed: string[] = [];
    const store = sheetSyncedStore(base, (id) => refreshed.push(id));
    await store.create({ recipient: 'p@example.ro', subject: 's', registrationDocumentId: 'reg-1' });
    await store.update('job-1', { status: 'sent', attempts: 1, lastError: null, sentAt: '2026-10-03T11:23:00.000Z' });
    expect(refreshed).toEqual(['reg-1', 'reg-1']);
  });

  it('does nothing for reads, nor for a job whose registration was deleted', async () => {
    const refreshed: string[] = [];
    const store = sheetSyncedStore({ ...base, update: async (documentId, data) => row({ documentId, ...data, registrationDocumentId: null }) }, (id) => refreshed.push(id));
    await store.findQueued(10);
    await store.findLatest('reg-1');
    await store.countForRecipientSince('p@example.ro', new Date());
    await store.update('job-1', { status: 'failed', attempts: 2, lastError: 'registration deleted', sentAt: null });
    expect(refreshed).toEqual([]);
  });
});
