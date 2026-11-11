import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..');
const read = (p: string) => JSON.parse(readFileSync(join(SRC, p), 'utf8'));
const registration = () =>
  read('api/registration-submission/content-types/registration-submission/schema.json').attributes;

describe('registration-submission, phase 2 fields', () => {

  it('enforces unique numbers in the database, not only in Strapi', () => {
    expect(registration().registrationNumber).toEqual({ type: 'string', unique: true, column: { unique: true } });
  });
});
