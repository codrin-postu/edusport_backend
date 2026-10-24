import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..');

it('keeps email-job private: hidden in the Content Manager, no generated routes', () => {
  const schema = JSON.parse(readFileSync(join(SRC, 'api/email-job/content-types/email-job/schema.json'), 'utf8'));
  expect(schema.pluginOptions).toEqual({ 'content-manager': { visible: false } });
  expect(schema.options).toEqual({ draftAndPublish: false });
  expect(readFileSync(join(SRC, 'api/email-job/routes/email-job.ts'), 'utf8')).toContain('{ only: [] }');
});

it('stores recipient, subject, kind, registration, status, attempts, lastError and sentAt', () => {
  const { attributes } = JSON.parse(readFileSync(join(SRC, 'api/email-job/content-types/email-job/schema.json'), 'utf8'));
  expect(Object.keys(attributes)).toEqual(['recipient', 'subject', 'kind', 'registration', 'status', 'attempts', 'lastError', 'sentAt']);
  expect(attributes.status).toEqual({ type: 'enumeration', enum: ['queued', 'sent', 'failed'], required: true, default: 'queued' });
  expect(attributes.attempts).toEqual({ type: 'integer', required: true, default: 0, min: 0 });
  expect(attributes.registration).toEqual({
    type: 'relation',
    relation: 'manyToOne',
    target: 'api::registration-submission.registration-submission',
    inversedBy: 'emailJobs',
  });
});

it('lets a registration reach its e-mail jobs, for the Sheet "E-mail" column', () => {
  const { attributes } = JSON.parse(readFileSync(join(SRC, 'api/registration-submission/content-types/registration-submission/schema.json'), 'utf8'));
  expect(attributes.emailJobs).toEqual({ type: 'relation', relation: 'oneToMany', target: 'api::email-job.email-job', mappedBy: 'registration' });
});
