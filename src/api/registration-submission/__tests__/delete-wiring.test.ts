import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const controller = readFileSync(join(__dirname, '..', 'controllers/registration-submission.ts'), 'utf8');
const method = (name: string, next: string) => controller.slice(controller.indexOf(`async ${name}(`), controller.indexOf(`async ${next}(`));

it('deleteArchivedSeason deletes the rows by the ids it collected, not by a second season query', () => {
  const del = method('deleteArchivedSeason', 'moveSeason');
  expect(del.length).toBeGreaterThan(0);
  expect(del).toMatch(/deleteRows: async \(ids\) => \(await strapi\.db\.query\(UID\)\.deleteMany\(\{ where: \{ documentId: \{ \$in: ids \} \} \}\)\)\.count/);
});

it('deleteSubmission deletes the e-mail jobs before the row, while the link still resolves', () => {
  const del = method('deleteSubmission', 'archiveSeason');
  const jobs = del.indexOf('deleteRegistrationEmailJobs(strapi, [documentId])');
  expect(jobs).toBeGreaterThan(-1);
  expect(jobs).toBeLessThan(del.indexOf('strapi.documents(UID).delete('));
});

it('deleteArchivedSeason deletes the e-mail jobs of the collected ids', () => {
  expect(method('deleteArchivedSeason', 'moveSeason')).toContain('deleteEmailJobs: (ids) => deleteRegistrationEmailJobs(strapi, ids)');
});
