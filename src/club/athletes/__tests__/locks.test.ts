import { describe, expect, it } from 'vitest';
import { lockAthletesWithRegistrations } from '../locks';
import { athleteRow, fakeClubStore, registrationRow } from './fake-store';

describe('lock order for merge and delete (polish 12)', () => {
  it('registrations linked to or matched with the athletes first, once each and sorted, then the athletes sorted', async () => {
    const fake = fakeClubStore({
      athletes: [athleteRow({ id: 'b' }), athleteRow({ id: 'a' }), athleteRow({ id: 'c' })],
      registrations: [
        registrationRow({ id: 'r3', athleteId: 'b' }),
        registrationRow({ id: 'r1', matchAthleteId: 'b' }),
        registrationRow({ id: 'r2', athleteId: 'a', matchAthleteId: 'b' }),
        registrationRow({ id: 'r4', athleteId: 'c', matchAthleteId: 'c' }),
      ],
    });
    await lockAthletesWithRegistrations(fake.store, ['b', 'a']);
    expect(fake.state.locks).toEqual(['r1', 'r2', 'r3', 'athlete:a', 'athlete:b']);
  });
});
