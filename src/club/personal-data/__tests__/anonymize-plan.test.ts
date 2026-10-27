import { describe, expect, it } from 'vitest';
import type { ConfirmationRecord } from '../../confirm/plan';
import {
  ATHLETE_PERSONAL_KEYS, MAX_BULK, REGISTRATION_KEPT_KEYS, REGISTRATION_NULLED_KEYS, athleteScrub, isAnonymized, readAnonymizeIds, registrationScrub,
  scrubChanges, scrubbedJobStatus,
} from '../anonymize-plan';

const CONFIRMATION: ConfirmationRecord = {
  athleteId: 'a1', createdAthlete: false, previousStatus: 'Contactat', athleteStatusBefore: 'activ',
  fieldsBefore: { phone: '0722111222', email: 'ana@example.com' }, fieldsAfter: { phone: '0733444555' },
  membershipId: 'gm1', demotedMainId: null, promotedMainId: null, acs: { id: 'acs1', previous: 'nu' }, seasonId: 's26', at: '2026-10-03T11:22:00.000Z',
};

describe('athlete scrub (spec 4)', () => {
  it('empties every personal field and marks the record anonymized', () => {
    const s = athleteScrub('2026-10-27T09:00:00.000Z');
    for (const key of ATHLETE_PERSONAL_KEYS.filter((k) => k !== 'name')) expect(s[key], key).toBeNull();
    expect(s).toMatchObject({ name: 'Sportiv anonimizat', dataIncomplete: false, status: 'anonimizat', anonymizedAt: '2026-10-27T09:00:00.000Z', profileId: null });
  });
});

describe('registration scrub (spec 4)', () => {
  it('nulls every personal field, writes "Anonimizat" as the child name and touches no kept field', () => {
    const s = registrationScrub(null);
    for (const key of REGISTRATION_NULLED_KEYS) expect(s[key], key).toBeNull();
    expect(s.childName).toBe('Anonimizat');
    expect(s.howHeard).toBeNull();
    expect(s.confirmation).toBeNull();
    for (const key of REGISTRATION_KEPT_KEYS) expect(Object.keys(s), key).not.toContain(key);
  });

  it('keeps the confirmation record, its personal values blanked', () => {
    const s = registrationScrub(CONFIRMATION);
    expect(s.confirmation).toEqual({ ...CONFIRMATION, fieldsBefore: { phone: null, email: null }, fieldsAfter: { phone: null } });
  });
});

describe('history scrubbing (spec 4)', () => {
  it('an old -> new pair under a personal key keeps its shape with both sides null', () => {
    expect(scrubChanges({ fields: { phone: { from: '0722', to: '0733' }, status: { from: 'Nou', to: 'Contactat' } } }))
      .toEqual({ fields: { phone: { from: null, to: null }, status: { from: 'Nou', to: 'Contactat' } } });
  });

  it('plain personal values become null, the rest is kept', () => {
    expect(scrubChanges({ name: 'Ilinca Pop' })).toEqual({ name: null });
    expect(scrubChanges({ athleteName: 'Ilinca Pop', createdAthlete: false, groupName: 'Începători' })).toEqual({ athleteName: null, createdAthlete: false, groupName: 'Începători' });
    expect(scrubChanges({ recipient: 'ana@example.com', documents: ['Ilinca-Pop_Acord_2026-2027.pdf'] })).toEqual({ recipient: null, documents: null });
    expect(scrubChanges({ registrationNumber: '2026-0142', schoolName: 'AFI' })).toEqual({ registrationNumber: '2026-0142', schoolName: 'AFI' });
    expect(scrubChanges({ fields: { childName: { from: '', to: 'Ilinca' }, parentName: { from: 'Ana', to: 'Dana' }, contactName: { from: null, to: 'Dana' } } }))
      .toEqual({ fields: { childName: { from: null, to: null }, parentName: { from: null, to: null }, contactName: { from: null, to: null } } });
  });

  it('walks arrays and nested objects at any depth', () => {
    const changes = {
      registrations: [{ documentId: 'r1', season: '2025-2026', email: 'a@x.ro' }, [{ info: { name: 'X', groupName: 'G' } }], 'r2'],
      deep: { list: [{ inner: { fields: { phone: { from: '0722', to: '0733' } } } }] },
    };
    expect(scrubChanges(changes)).toEqual({
      registrations: [{ documentId: 'r1', season: '2025-2026', email: null }, [{ info: { name: null, groupName: 'G' } }], 'r2'],
      deep: { list: [{ inner: { fields: { phone: { from: null, to: null } } } }] },
    });
  });

  it('is stable: scrubbing twice changes nothing more', () => {
    const once = scrubChanges({ fields: { email: { from: 'a@x.ro', to: 'b@x.ro' } }, recipient: 'a@x.ro' });
    expect(scrubChanges(once)).toEqual(once);
  });
});

describe('e-mail jobs, guards, bulk body', () => {
  it('a queued job is cancelled; sent and failed stay', () => {
    expect(scrubbedJobStatus('queued')).toBe('cancelled');
    expect(scrubbedJobStatus('sent')).toBe('sent');
    expect(scrubbedJobStatus('failed')).toBe('failed');
  });

  it('knows an anonymized athlete', () => {
    expect(isAnonymized({ status: 'anonimizat' })).toBe(true);
    expect(isAnonymized({ status: 'inactiv' })).toBe(false);
    expect(isAnonymized(null)).toBe(false);
  });

  it('reads 1 to 200 ids, without repeats', () => {
    expect(readAnonymizeIds({ documentIds: ['a', 'b', 'a'] })).toEqual(['a', 'b']);
    expect(readAnonymizeIds({ documentIds: [] })).toBeNull();
    expect(readAnonymizeIds({ documentIds: ['a', ''] })).toBeNull();
    expect(readAnonymizeIds({ documentIds: ['a', 3] })).toBeNull();
    expect(readAnonymizeIds({ documentIds: Array.from({ length: MAX_BULK + 1 }, (_, i) => `id${i}`) })).toBeNull();
    expect(readAnonymizeIds({ documentIds: Array.from({ length: MAX_BULK }, (_, i) => `id${i}`) })).toHaveLength(MAX_BULK);
    expect(readAnonymizeIds(null)).toBeNull();
  });
});
