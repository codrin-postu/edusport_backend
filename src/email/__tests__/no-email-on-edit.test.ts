import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const controller = readFileSync(join(__dirname, '..', '..', 'api/registration-submission/controllers/registration-submission.ts'), 'utf8');
const method = (name: string, next: string) => controller.slice(controller.indexOf(`async ${name}(`), controller.indexOf(`async ${next}(`));

it('queues the e-mail once, in the public submit, after the documents', () => {
  expect(controller.match(/queueEmailAfterSubmit\(/g)).toHaveLength(1);
  const submit = method('submitPublic', 'list');
  expect(submit.indexOf('queueEmailAfterSubmit(')).toBeGreaterThan(submit.indexOf('finishSubmit('));
});

it('never e-mails from an admin edit (DECISIONS 2026-10-05)', () => {
  const edit = method('updateSubmission', 'deleteSubmission');
  expect(edit.length).toBeGreaterThan(0);
  expect(edit).not.toMatch(/queueEmailAfterSubmit|enqueueRegistrationEmail|resendRegistrationEmail/);
});
