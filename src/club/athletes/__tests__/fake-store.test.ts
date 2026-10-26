import { describe, expect, it } from 'vitest';
import { athleteRow, fakeClubStore, registrationRow } from './fake-store';

describe('the in-memory store used by the service tests', () => {
  it('rolls a failed transaction back completely', async () => {
    const { store, state, failOn } = fakeClubStore({ athletes: [athleteRow({ id: 'a1' })] });
    failOn('createMembership');
    await expect(store.transaction(async () => {
      await store.createAthlete({ name: 'Nou' });
      await store.createMembership({ athleteId: 'a1', groupId: 'g-pp', seasonId: 's26', isMain: true, from: null });
    })).rejects.toThrow('fake failure in createMembership');
    expect(state.athletes.map((a) => a.id)).toEqual(['a1']);
  });

  it('fails only once and hands out copies', async () => {
    const { store, failOn } = fakeClubStore({ athletes: [athleteRow({ id: 'a1', name: 'Ana' })] });
    failOn('athlete');
    await expect(store.athlete('a1')).rejects.toThrow();
    const copy = await store.athlete('a1');
    if (copy) copy.name = 'changed';
    expect((await store.athlete('a1'))?.name).toBe('Ana');
  });

  it('keeps a dismissed pair, marked dismissed', async () => {
    const { store } = fakeClubStore({ athletes: [athleteRow({ id: 'a1' }), athleteRow({ id: 'a2' })] });
    await store.createDuplicate('a1', 'a2');
    const [pair] = await store.duplicates();
    expect(pair).toEqual({ id: pair.id, firstId: 'a1', secondId: 'a2', dismissed: false });
    await store.dismissDuplicate(pair.id);
    expect(await store.duplicates()).toEqual([{ ...pair, dismissed: true }]);
  });

  it('re-creates a pair as dismissed when asked', async () => {
    const { store } = fakeClubStore();
    await store.createDuplicate('a1', 'a2', true);
    expect((await store.duplicates()).map((d) => d.dismissed)).toEqual([true]);
  });

  it('deleting an athlete clears the links and the matches to it, as the Strapi store does', async () => {
    const { store, state } = fakeClubStore({
      athletes: [athleteRow({ id: 'a1' })],
      registrations: [registrationRow({ id: 'r1', athleteId: 'a1', matchAthleteId: 'a1', matchLevel: 'sigur' })],
    });
    await store.deleteAthlete('a1');
    expect(state.registrations[0]).toMatchObject({ athleteId: null, matchAthleteId: null, matchLevel: null });
  });

  it('deleting a profile unlinks it from its athlete', async () => {
    const { store, state } = fakeClubStore({ athletes: [athleteRow({ id: 'a1', profileId: 'sp1' })] });
    state.profiles.push({ id: 'sp1', name: 'Ana', slug: 'ana', previousSlugs: [], showPublicPage: true, published: true });
    await store.deleteProfile('sp1');
    expect(state.athletes[0].profileId).toBeNull();
    expect(state.removedParticipations).toEqual(['sp1']);
  });

  it('a new athlete is not marked incomplete unless asked, like the schema default', async () => {
    const { store } = fakeClubStore();
    const id = await store.createAthlete({ name: 'Ana' });
    expect((await store.athlete(id))?.dataIncomplete).toBe(false);
  });
});
