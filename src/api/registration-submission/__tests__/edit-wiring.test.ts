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

it('the edit holds the row as the confirmation does; a 409 (linked status) and a 500 (failed save) keep their message', () => {
  const deps = readFileSync(join(__dirname, '..', 'edit-deps.ts'), 'utf8');
  expect(deps).toContain('await store.lockRegistration(id);');
  expect(deps).toContain("populate: ['athlete', 'matchAthlete']");
  const put = method('updateSubmission', 'deleteSubmission');
  expect(put).toContain('result.status === 409 || result.status === 500');
  expect(put).toContain("ctx.body = { data: null, error: { status: result.status, name: 'ClubAdminError', message: result.error } };");
});
