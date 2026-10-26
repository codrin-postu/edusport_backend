import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const controller = readFileSync(join(__dirname, '..', 'controllers/registration-submission.ts'), 'utf8');
const submit = controller.slice(controller.indexOf('async submitPublic('), controller.indexOf('async list('));

it('records the submit and matches it, only for a new registration (not a repeat of the same draft)', () => {
  expect(submit).toContain('if (saved.ok === true && !saved.repeat) await afterRegistrationSubmitted(clubStore(strapi), saved.documentId');
});
