import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const API = join(__dirname, '..', '..', 'api');
const schema = (name: string) => JSON.parse(readFileSync(join(API, name, 'content-types', name, 'schema.json'), 'utf8'));

describe('athlete, phase 3', () => {
  it('has one full-name field and keeps first/last readable until deploy step 7', () => {
    const a = schema('athlete').attributes;
    expect(a.name).toEqual({ type: 'string' });
    expect(a.firstName).toEqual({ type: 'string' });
    expect(a.lastName).toEqual({ type: 'string' });
  });

  it('stores the e-mail as plain text, so an old registration never fails a confirmation', () => {
    expect(schema('athlete').attributes.email).toEqual({ type: 'string' });
  });
});

describe('registration-submission, phase 3', () => {
  it('saves the match, the parsed birth date and what the confirmation wrote', () => {
    const a = schema('registration-submission').attributes;
    expect(a.matchAthlete).toEqual({ type: 'relation', relation: 'manyToOne', target: 'api::athlete.athlete' });
    expect(a.matchLevel).toEqual({ type: 'enumeration', enum: ['sigur', 'probabil'] });
    expect(a.childBirthDateParsed).toEqual({ type: 'date' });
    expect(a.confirmation).toEqual({ type: 'json', private: true, visible: false });
  });
});

describe('possible duplicates', () => {
  it('pair two athletes in a hidden type', () => {
    const s = schema('athlete-duplicate');
    expect(s.collectionName).toBe('athlete_duplicates');
    expect(s.pluginOptions).toEqual({ 'content-manager': { visible: false } });
    expect(s.attributes).toEqual({
      first: { type: 'relation', relation: 'manyToOne', target: 'api::athlete.athlete' },
      second: { type: 'relation', relation: 'manyToOne', target: 'api::athlete.athlete' },
    });
  });
});

describe('sportsperson, phase 3', () => {
  it('remembers the addresses merged into it, never in the public API or the admin', () => {
    expect(schema('sportsperson').attributes.previousSlugs).toEqual({ type: 'json', private: true, visible: false });
  });
});
