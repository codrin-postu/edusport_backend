import { describe, expect, it, vi } from 'vitest';
import { planMatchUpdates, refreshAllMatches, refreshRegistrationMatch, safely } from '../matches';
import { afterRegistrationSubmitted } from '../registration-hooks';
import { athleteRow, fakeClubStore, registrationRow } from './fake-store';

const maria = athleteRow({ id: 'a1', name: 'Maria Pop', birthDate: '2016-03-14', status: 'inactiv' });

describe('planMatchUpdates (spec 2.1, 2.2)', () => {
  it('saves the best Sigur or Probabil match and the parsed birth date; inactive athletes count', () => {
    expect(planMatchUpdates([registrationRow({ id: 'r1' })], [maria])).toEqual([
      { registrationId: 'r1', patch: { matchAthleteId: 'a1', matchLevel: 'sigur', childBirthDateParsed: '2016-03-14' } },
    ]);
  });

  it('clears the match of a linked registration and writes nothing when unchanged', () => {
    const linked = registrationRow({ id: 'r1', athleteId: 'a1', matchAthleteId: 'a1', matchLevel: 'sigur', childBirthDateParsed: '2016-03-14' });
    const same = registrationRow({ id: 'r2', matchAthleteId: 'a1', matchLevel: 'sigur', childBirthDateParsed: '2016-03-14' });
    expect(planMatchUpdates([linked, same], [maria])).toEqual([
      { registrationId: 'r1', patch: { matchAthleteId: null, matchLevel: null, childBirthDateParsed: '2016-03-14' } },
    ]);
  });

  it('empties the parsed date when the text became unreadable', () => {
    const stale = registrationRow({ id: 'r1', childBirthDate: 'ieri', childBirthDateParsed: '2016-03-14' });
    expect(planMatchUpdates([stale], [])).toEqual([{ registrationId: 'r1', patch: { matchAthleteId: null, matchLevel: null, childBirthDateParsed: null } }]);
  });
});

describe('refresh (spec 2.2)', () => {
  it('rewrites only the registrations whose match changed', async () => {
    const fake = fakeClubStore({ athletes: [maria], registrations: [registrationRow({ id: 'r1' }), registrationRow({ id: 'r2', childName: 'Ion Ilie' })] });
    expect(await refreshAllMatches(fake.store)).toBe(2);
    expect(fake.state.registrations.map((r) => [r.id, r.matchLevel])).toEqual([['r1', 'sigur'], ['r2', null]]);
    expect(await refreshAllMatches(fake.store)).toBe(0);
  });

  it('refreshes one registration', async () => {
    const fake = fakeClubStore({ athletes: [maria], registrations: [registrationRow({ id: 'r1' })] });
    await refreshRegistrationMatch(fake.store, 'r1');
    expect(fake.state.registrations[0].matchAthleteId).toBe('a1');
  });

  it('safely logs a failure and never throws', async () => {
    const log = vi.fn();
    await safely(async () => { throw new Error('boom'); }, log, 'refresh');
    expect(log).toHaveBeenCalledWith('[athletes] refresh failed: boom');
  });
});

describe('after a public submit', () => {
  it('writes "Înscriere înregistrată" and saves the match', async () => {
    const fake = fakeClubStore({ athletes: [maria], registrations: [registrationRow({ id: 'r1' })] });
    await afterRegistrationSubmitted(fake.store, 'r1', vi.fn());
    expect(fake.state.history.map((h) => [h.subjectId, h.action, h.actor])).toEqual([['r1', 'submitted', 'formular']]);
    expect(fake.state.registrations[0].matchLevel).toBe('sigur');
  });

  it('never fails the submit', async () => {
    const fake = fakeClubStore({ registrations: [registrationRow({ id: 'r1' })] });
    fake.failOn('record');
    const log = vi.fn();
    await afterRegistrationSubmitted(fake.store, 'r1', log);
    expect(log).toHaveBeenCalledOnce();
  });
});
