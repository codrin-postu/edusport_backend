import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const read = (p: string) => JSON.parse(readFileSync(join(__dirname, '..', '..', 'api', p), 'utf8'));

it('calendar events can optionally belong to a group', () => {
  const s = read('calendar-event/content-types/calendar-event/schema.json');
  expect(s.attributes.group).toEqual({ type: 'relation', relation: 'manyToOne', target: 'api::group.group' });
});

it('registrations carry a number and optional links, and keep the old season text', () => {
  const s = read('registration-submission/content-types/registration-submission/schema.json');
  expect(s.attributes.registrationNumber).toEqual({ type: 'string', unique: true, column: { unique: true } });
  expect(s.attributes.section).toEqual({ type: 'relation', relation: 'manyToOne', target: 'api::section.section' });
  expect(s.attributes.seasonRef).toEqual({ type: 'relation', relation: 'manyToOne', target: 'api::season.season' });
  expect(s.attributes.athlete).toEqual({ type: 'relation', relation: 'manyToOne', target: 'api::athlete.athlete' });
  expect(s.attributes.season).toEqual({ type: 'string' });
});
