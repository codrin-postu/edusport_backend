import { describe, expect, it } from 'vitest';
import { moveRegistrationsToSeason, moveRegistrationsToSeasonInBackground, type SeasonMoveDeps } from '../season-move';

const A = 'reg0000000000000000000001';
const B = 'reg0000000000000000000002';
const C = 'reg0000000000000000000003';

function fake(over: Partial<SeasonMoveDeps> = {}) {
  const calls: string[] = [];
  const errors: string[] = [];
  const deps: SeasonMoveDeps = {
    seasonIdFor: async (label) => (label === '2027-2028' ? 'season2027' : null),
    setSeason: async (id, label, seasonRef) => {
      calls.push(`set ${id} ${label} ${seasonRef}`);
      return id !== C;
    },
    rebuild: async (id) => {
      calls.push(`rebuild ${id}`);
      return { ok: true, documents: ['acord'] };
    },
    logError: (m) => {
      errors.push(m);
    },
    ...over,
  };
  return { deps, calls, errors };
}

describe('moveRegistrationsToSeason', () => {
  it('sets the season text and its Sezon together, then rebuilds each moved registration', async () => {
    const { deps, calls, errors } = fake();
    await expect(moveRegistrationsToSeason([A, B], '2027-2028', deps)).resolves.toBe(2);
    expect(calls).toEqual([`set ${A} 2027-2028 season2027`, `rebuild ${A}`, `set ${B} 2027-2028 season2027`, `rebuild ${B}`]);
    expect(errors).toEqual([]);
  });

  it('an unknown season label sets seasonRef to null and skips the rebuild with a logged reason', async () => {
    const { deps, calls, errors } = fake();
    await expect(moveRegistrationsToSeason([A], '2030-2031', deps)).resolves.toBe(1);
    expect(calls).toEqual([`set ${A} 2030-2031 null`]);
    expect(errors).toEqual(['[inscrieri] no Sezon is labelled "2030-2031": documents of 1 moved registration(s) not rebuilt']);
  });

  it('never aborts: a failing registration is logged, a missing one is not counted, the others move', async () => {
    const { deps, calls, errors } = fake({
      setSeason: async (id, label, seasonRef) => {
        calls.push(`set ${id} ${label} ${seasonRef}`);
        if (id === A) throw new Error('database down');
        return id !== C;
      },
    });
    await expect(moveRegistrationsToSeason([A, C, B], '2027-2028', deps)).resolves.toBe(1);
    expect(calls).toEqual([`set ${A} 2027-2028 season2027`, `set ${C} 2027-2028 season2027`, `set ${B} 2027-2028 season2027`, `rebuild ${B}`]);
    expect(errors).toEqual([`[inscrieri] moving ${A} to 2027-2028 failed: database down`]);
  });
});

describe('moveRegistrationsToSeasonInBackground', () => {
  it('answers with the moved count before any rebuild runs, then rebuilds every moved registration', async () => {
    const { deps, calls } = fake();
    const { moved, rebuilt } = await moveRegistrationsToSeasonInBackground([A, B], '2027-2028', deps);
    expect(moved).toBe(2);
    expect(calls).toEqual([`set ${A} 2027-2028 season2027`, `set ${B} 2027-2028 season2027`]);
    await rebuilt;
    expect(calls).toEqual([`set ${A} 2027-2028 season2027`, `set ${B} 2027-2028 season2027`, `rebuild ${A}`, `rebuild ${B}`]);
  });

  it('an unknown season label moves the rows, skips the rebuild once it runs, and logs it', async () => {
    const { deps, calls, errors } = fake();
    const { moved, rebuilt } = await moveRegistrationsToSeasonInBackground([A], '2030-2031', deps);
    expect(moved).toBe(1);
    expect(errors).toEqual([]);
    await rebuilt;
    expect(calls).toEqual([`set ${A} 2030-2031 null`]);
    expect(errors).toEqual(['[inscrieri] no Sezon is labelled "2030-2031": documents of 1 moved registration(s) not rebuilt']);
  });

  it('a rebuild failure is logged in the background and the rest still rebuild', async () => {
    const built: string[] = [];
    const { deps, errors } = fake({
      rebuild: async (id) => {
        if (id === A) throw new Error('disk full');
        built.push(id);
        return { ok: true, documents: ['acord'] };
      },
    });
    const { moved, rebuilt } = await moveRegistrationsToSeasonInBackground([A, B], '2027-2028', deps);
    expect(moved).toBe(2);
    await rebuilt;
    expect(built).toEqual([B]);
    expect(errors).toEqual([`[inscrieri] rebuilding documents of ${A} after moving to 2027-2028 failed: disk full`]);
  });
});
