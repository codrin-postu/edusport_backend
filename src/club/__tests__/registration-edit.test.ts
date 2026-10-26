import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import {
  REGISTRATION_EDIT_ERROR,
  documentRebuiltEntry,
  fieldsClearedByEdit,
  normalizeRegistrationEdit,
  registrationEditError,
} from '../registration-edit';

it('accepts the stored option values only', () => {
  expect(registrationEditError({ relationship: 'tutore' })).toBeNull();
  expect(registrationEditError({ membershipAnswer: 'nu' })).toBeNull();
  expect(registrationEditError({ relationshipOther: 'Bunică' })).toBeNull();
  expect(registrationEditError({ status: 'Nou' })).toBeNull();
  expect(registrationEditError({ relationship: 'Părinte' })).toBe(REGISTRATION_EDIT_ERROR);
  expect(registrationEditError({ relationship: null })).toBe(REGISTRATION_EDIT_ERROR);
  expect(registrationEditError({ membershipAnswer: 'Da' })).toBe(REGISTRATION_EDIT_ERROR);
  expect(registrationEditError({ relationshipOther: 3 })).toBe(REGISTRATION_EDIT_ERROR);
});

it('clears the "Alta" text when the relationship moves off Alta, and trims it otherwise', () => {
  expect(normalizeRegistrationEdit({ relationship: 'parinte' })).toEqual({ relationship: 'parinte', relationshipOther: null });
  expect(normalizeRegistrationEdit({ relationship: 'alta' })).toEqual({ relationship: 'alta' });
  expect(normalizeRegistrationEdit({ relationshipOther: '  Bunică ' })).toEqual({ relationshipOther: 'Bunică' });
  expect(normalizeRegistrationEdit({ relationshipOther: ' ' })).toEqual({ relationshipOther: null });
  expect(normalizeRegistrationEdit({ status: 'Nou' })).toEqual({ status: 'Nou' });
});

it('a saved Calitate other than Alta also clears the "Alta" text in the panel row', () => {
  expect(fieldsClearedByEdit('relationship', 'parinte')).toEqual({ relationshipOther: null });
  expect(fieldsClearedByEdit('relationship', 'alta')).toBeNull();
  expect(fieldsClearedByEdit('relationshipOther', 'Bunică')).toBeNull();
  expect(fieldsClearedByEdit('membershipAnswer', 'nu')).toBeNull();
});

it('writes "Document refăcut" with the rebuilt documents and the admin', () => {
  expect(documentRebuiltEntry('d1', ['acord', 'adeziune'], 'ana@club.ro')).toEqual({
    subjectType: 'registration-submission',
    subjectId: 'd1',
    action: 'document-rebuilt',
    changes: { documents: ['acord', 'adeziune'] },
    actor: 'ana@club.ro',
  });
});

it('the admin PUT accepts these fields, checks them and records the rebuild', () => {
  const update = readFileSync(join(__dirname, '..', 'registration-update.ts'), 'utf8');
  expect(update).toContain('...REGISTRATION_EDIT_FIELDS,');
  expect(update).toContain('return registrationEditError(data);');
  expect(update).toContain('if (rebuild?.ok) await guarded(');
});
