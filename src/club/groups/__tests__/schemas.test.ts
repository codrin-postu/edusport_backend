import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..', '..');
const json = (p: string) => JSON.parse(readFileSync(join(SRC, p), 'utf8'));
const source = (p: string) => readFileSync(join(SRC, p), 'utf8');

describe('phase 4 schema', () => {
  it('groups carry "Program public", on by default (3.1, W8)', () => {
    expect(json('api/group/content-types/group/schema.json').attributes.programPublic).toEqual({ type: 'boolean', default: true });
  });

  it('a per-date exception keeps an optional reason of at most 120 characters (3.4)', () => {
    expect(json('components/calendar/exception.json').attributes.reason).toEqual({ type: 'string', maxLength: 120 });
  });

  it('e-mail jobs know schedule changes: group, payload, change key and a not-before time (3.6)', () => {
    const a = json('api/email-job/content-types/email-job/schema.json').attributes;
    expect(a.kind).toEqual({ type: 'enumeration', enum: ['registration', 'schedule-change', 'payment'], required: true, default: 'registration' });
    expect(a.group).toEqual({ type: 'relation', relation: 'manyToOne', target: 'api::group.group' });
    expect(a.payload).toEqual({ type: 'json' });
    expect(a.changeKey).toEqual({ type: 'string' });
    expect(a.notBefore).toEqual({ type: 'datetime' });
  });

  it('calendar events and breaks have no generated content-api routes, so a non-public group never leaks (8.3)', () => {
    for (const name of ['calendar-event', 'calendar-blackout']) {
      expect(source(`api/${name}/routes/${name}.ts`), name).toContain('{ only: [] }');
    }
  });
});
