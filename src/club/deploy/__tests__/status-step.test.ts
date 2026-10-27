import { describe, expect, it } from 'vitest';
import { planMatchUpdates } from '../../athletes/matches';
import { athleteRow, fakeClubStore, registrationRow } from '../../athletes/__tests__/fake-store';
import { applyStatusChange, planStatusStep } from '../status-step';

const seed = () => ({
  athletes: [
    athleteRow({ id: 'older', name: 'Maria Pop', status: 'activ', updatedAt: '2026-10-01T10:00:00.000Z' }),
    athleteRow({ id: 'newer', name: 'Maria Pop', status: 'inactiv', updatedAt: '2026-10-02T10:00:00.000Z' }),
    athleteRow({ id: 'ion', name: 'Ion Ilie', birthDate: '2015-02-01', status: 'inactiv' }),
  ],
  registrations: [
    registrationRow({ id: 'r1', matchAthleteId: 'newer', matchLevel: 'probabil', childBirthDateParsed: '2016-03-14' }),
    registrationRow({ id: 'r2', childName: 'Ion Ilie', childBirthDate: '01.02.2015', matchAthleteId: 'ion', matchLevel: 'sigur', childBirthDateParsed: '2015-02-01' }),
  ],
});

async function runStep(store: Parameters<typeof applyStatusChange>[0]) {
  const plan = await planStatusStep(store);
  if (!plan) throw new Error('no current season');
  for (const c of plan.changes) await applyStatusChange(store, c, 'migrare');
  return plan;
}

describe('step 12 on the store: guard and re-run', () => {
  it('a second run passes with zero changes although a tie-break reorder left step 10 work', async () => {
    const { store, state } = fakeClubStore(seed());
    const first = await runStep(store);
    expect(first.pendingSigur).toEqual([]);
    expect(first.changes).toEqual([
      { id: 'older', from: 'activ', to: 'inactiv' },
      { id: 'ion', from: 'inactiv', to: 'activ' },
    ]);
    expect(planMatchUpdates(state.registrations, state.athletes)).toEqual([
      { registrationId: 'r1', patch: { matchAthleteId: 'older', matchLevel: 'probabil', childBirthDateParsed: '2016-03-14' } },
    ]);
    const second = await runStep(store);
    expect(second.pendingSigur).toEqual([]);
    expect(second.changes).toEqual([]);
    expect(state.history.filter((h) => h.action === 'status-changed').map((h) => [h.subjectId, h.actor])).toEqual([['older', 'migrare'], ['ion', 'migrare']]);
  });

  it('reports a pending change to a Sigur link of the current season', async () => {
    const data = seed();
    data.registrations[1].matchAthleteId = null;
    data.registrations[1].matchLevel = null;
    const plan = await planStatusStep(fakeClubStore(data).store);
    expect(plan?.pendingSigur).toEqual(['r2']);
  });

  it('never plans a change for an anonymized athlete, old or current activity, and stays empty on a second apply', async () => {
    const data = seed();
    data.athletes.push(
      athleteRow({ id: 'anon-old', name: 'Veche Anonimizata', status: 'anonimizat', updatedAt: '2020-01-01T10:00:00.000Z' }),
      athleteRow({ id: 'anon-current', name: 'Curenta Anonimizata', status: 'anonimizat' }),
    );
    data.registrations.push(registrationRow({ id: 'r3', childName: 'Curenta Anonimizata', athleteId: 'anon-current' }));
    const { store, state } = fakeClubStore(data);
    const first = await runStep(store);
    expect(first.changes.some((c) => c.id === 'anon-old' || c.id === 'anon-current')).toBe(false);
    expect(state.athletes.find((a) => a.id === 'anon-old')?.status).toBe('anonimizat');
    expect(state.athletes.find((a) => a.id === 'anon-current')?.status).toBe('anonimizat');
    const second = await runStep(store);
    expect(second.changes).toEqual([]);
  });
});
