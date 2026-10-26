import { describe, expect, it } from 'vitest';
import { blockingStep, DEPLOY_STEP_NEEDS } from '../step-order';

const pendingOf = (left: Record<string, number>) => async (step: string) => left[step] ?? 0;

describe('deploy step order (spec 11)', () => {
  it('status refuses while an athlete-creating step still has work (final review M1)', async () => {
    expect(await blockingStep('status', pendingOf({ 'past-registrations': 3 }))).toEqual({ step: 'past-registrations', left: 3 });
    expect(await blockingStep('status', pendingOf({ 'athlete-name': 1, 'past-registrations': 3 }))).toEqual({ step: 'athlete-name', left: 1 });
    expect(await blockingStep('status', pendingOf({}))).toBeNull();
  });

  it('the first step needs nothing; every needed step is one whose pending work the script counts', async () => {
    expect(await blockingStep('athlete-name', pendingOf({ 'athlete-name': 5 }))).toBeNull();
    const counted = new Set(['athlete-name', 'profile-athletes', 'past-registrations']);
    expect(Object.values(DEPLOY_STEP_NEEDS).flat().filter((s) => !counted.has(s))).toEqual([]);
  });
});
