import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const controller = readFileSync(join(__dirname, '..', 'controllers/sportsperson.ts'), 'utf8');

it('the public list answers a merged-away address with the published, visible profile that remembers it', () => {
  const find = controller.slice(controller.indexOf('async find('), controller.indexOf('async publishOne('));
  expect(find).toContain('previousSlugQuery(');
  expect(find).toContain("where: { publishedAt: { $notNull: true }, showPublicPage: true }");
  expect(find.match(/super\.find\(ctx\)/g)).toHaveLength(2);
});
