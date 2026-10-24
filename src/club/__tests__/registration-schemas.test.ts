import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..');
const read = (p: string) => JSON.parse(readFileSync(join(SRC, p), 'utf8'));
const registration = () =>
  read('api/registration-submission/content-types/registration-submission/schema.json').attributes;

describe('registration-submission, phase 2 fields', () => {
  it('stores the script form answers', () => {
    const a = registration();
    expect(a.relationship).toEqual({ type: 'enumeration', enum: ['parinte', 'tutore', 'alta'] });
    expect(a.relationshipOther).toEqual({ type: 'string' });
    expect(a.childHeight).toEqual({ type: 'integer' });
    expect(a.lastSeason).toEqual({ type: 'string' });
    expect(a.membershipAnswer).toEqual({ type: 'enumeration', enum: ['da', 'nu'] });
    expect(a.subscriptionChoice).toEqual({ type: 'json' });
    expect(a.source).toEqual({ type: 'string' });
    expect(a.sourceOther).toEqual({ type: 'string' });
    expect(a.gdprConsent).toEqual({ type: 'boolean' });
    expect(a.regulationsConsent).toEqual({ type: 'boolean' });
  });

  it('no longer requires answers only the old website form asked', () => {
    const a = registration();
    expect(a.howHeard).toEqual({ type: 'string' });
    expect(a.privacyConsent).toEqual({ type: 'boolean', default: false });
  });

  it('keeps the draft key out of the API and the content manager', () => {
    expect(registration().submissionKey).toEqual({ type: 'string', private: true, visible: false });
  });

  it('enforces unique numbers in the database, not only in Strapi', () => {
    expect(registration().registrationNumber).toEqual({ type: 'string', unique: true, column: { unique: true } });
  });
});

describe('prices and notes', () => {
  it('price items carry an optional tooltip', () => {
    expect(read('components/club/price-item.json').attributes.tooltip).toEqual({ type: 'text' });
  });

  it('price lists have no visibility switch (every list is shown, per audience)', () => {
    expect(read('api/price-list/content-types/price-list/schema.json').attributes.showPublic).toBeUndefined();
  });

  it('sections carry their price notes as a json list', () => {
    expect(read('api/section/content-types/section/schema.json').attributes.priceNotes).toEqual({ type: 'json' });
  });
});
