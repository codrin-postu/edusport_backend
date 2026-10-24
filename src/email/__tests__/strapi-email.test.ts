import type { Core } from '@strapi/strapi';
import { expect, it } from 'vitest';
import { deleteRegistrationEmailJobs, toJobRow } from '../strapi-email';

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

function fakeStrapi() {
  const calls: { uid: string; params: unknown }[] = [];
  const strapi = {
    db: {
      query: (uid: string) => ({
        deleteMany: async (params: unknown) => {
          calls.push({ uid, params });
          return { count: 2 };
        },
      }),
    },
  } as unknown as Core.Strapi;
  return { strapi, calls };
}

it('deletes the e-mail jobs linked to the given registrations', async () => {
  const { strapi, calls } = fakeStrapi();
  await expect(deleteRegistrationEmailJobs(strapi, ['reg-1', 'reg-2'])).resolves.toBe(2);
  expect(calls).toEqual([
    { uid: 'api::email-job.email-job', params: { where: { registration: { documentId: { $in: ['reg-1', 'reg-2'] } } } } },
  ]);
});

it('runs no delete for an empty id list', async () => {
  const { strapi, calls } = fakeStrapi();
  await expect(deleteRegistrationEmailJobs(strapi, [])).resolves.toBe(0);
  expect(calls).toEqual([]);
});
