import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..', 'api');
const NEW_TYPES = ['season', 'location', 'section', 'price-list', 'group', 'athlete', 'group-membership', 'acs-membership', 'history-entry'];

describe.each(NEW_TYPES)('content type %s', (name) => {
  const schema = JSON.parse(readFileSync(join(ROOT, name, 'content-types', name, 'schema.json'), 'utf8'));
  const router = readFileSync(join(ROOT, name, 'routes', `${name}.ts`), 'utf8');

  it('is a collection type without draft and publish', () => {
    expect(schema.kind).toBe('collectionType');
    expect(schema.options.draftAndPublish).toBe(false);
  });
  it('exposes no generated content-API routes', () => {
    expect(router).toContain(`createCoreRouter('api::${name}.${name}', { only: [] })`);
  });
});

it('athlete links one-to-one to the public profile (sportsperson)', () => {
  const athlete = JSON.parse(readFileSync(join(ROOT, 'athlete', 'content-types', 'athlete', 'schema.json'), 'utf8'));
  expect(athlete.attributes.publicProfile).toEqual({ type: 'relation', relation: 'oneToOne', target: 'api::sportsperson.sportsperson' });
});
