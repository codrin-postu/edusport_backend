import { describe, expect, it, vi } from 'vitest';
import { beforeRegistrationDeleted } from '../registration-hooks';
import { fakeClubStore, registrationRow } from './fake-store';

describe('deleting a confirmed registration (spec 4.6, r4 e3)', () => {
  it('notes "Înscriere ștearsă" on the athlete', async () => {
    const fake = fakeClubStore({ registrations: [registrationRow({ id: 'r1', athleteId: 'a1' })] });
    await beforeRegistrationDeleted(fake.store, 'r1', 'ana@club.ro', vi.fn());
    expect(fake.state.history.map((h) => [h.subjectId, h.action, h.changes])).toEqual([['a1', 'registration-deleted', { registrationNumber: '2026-0142' }]]);
  });

  it('writes nothing for an unconfirmed one', async () => {
    const fake = fakeClubStore({ registrations: [registrationRow({ id: 'r1' })] });
    await beforeRegistrationDeleted(fake.store, 'r1', 'ana@club.ro', vi.fn());
    expect(fake.state.history).toEqual([]);
  });
});
