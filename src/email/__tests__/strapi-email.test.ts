import { expect, it } from 'vitest';
import { toJobRow } from '../strapi-email';

it('maps a stored job, with the registration documentId and ISO dates', () => {
  expect(
    toJobRow({
      documentId: 'job-1',
      recipient: 'parinte@example.ro',
      subject: 'Înscriere înregistrată: Maria Pop (nr. 2026-0008)',
      status: 'sent',
      attempts: 2,
      lastError: null,
      sentAt: new Date('2026-10-20T09:00:00.000Z'),
      updatedAt: '2026-10-20T09:00:01.000Z',
      registration: { documentId: 'reg-1' },
    }),
  ).toEqual({
    documentId: 'job-1',
    recipient: 'parinte@example.ro',
    subject: 'Înscriere înregistrată: Maria Pop (nr. 2026-0008)',
    registrationDocumentId: 'reg-1',
    status: 'sent',
    attempts: 2,
    lastError: null,
    sentAt: '2026-10-20T09:00:00.000Z',
    updatedAt: '2026-10-20T09:00:01.000Z',
  });
});

it('reads a job whose registration was deleted as having none', () => {
  expect(toJobRow({ documentId: 'job-2', registration: null })).toMatchObject({ registrationDocumentId: null, status: 'queued', attempts: 0, recipient: '' });
});
