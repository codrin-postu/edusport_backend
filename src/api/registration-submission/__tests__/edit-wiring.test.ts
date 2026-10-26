import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const controller = readFileSync(join(__dirname, '..', 'controllers/registration-submission.ts'), 'utf8');
const method = (name: string, next: string) => controller.slice(controller.indexOf(`async ${name}(`), controller.indexOf(`async ${next}(`));

it('the PUT goes through updateRegistration', () => {
  expect(method('updateSubmission', 'deleteSubmission')).toContain('updateRegistration(registrationEditDeps(strapi)');
});

it('a delete notes it on the athlete before the row goes', () => {
  const del = method('deleteSubmission', 'archiveSeason');
  expect(del.indexOf('beforeRegistrationDeleted(')).toBeGreaterThan(-1);
  expect(del.indexOf('beforeRegistrationDeleted(')).toBeLessThan(del.indexOf('strapi.documents(UID).delete('));
  expect(method('deleteArchivedSeason', 'moveSeason')).toContain('beforeRegistrationDeleted(');
});

it('the edit holds the row as the confirmation does, and a status change on a linked one is a 409', () => {
  const deps = readFileSync(join(__dirname, '..', 'edit-deps.ts'), 'utf8');
  expect(deps).toContain('await store.lockRegistration(id);');
  expect(deps).toContain("populate: ['athlete', 'matchAthlete']");
  expect(method('updateSubmission', 'deleteSubmission')).toContain('ctx.status = 409;');
});
