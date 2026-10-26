/** Deploy steps 7 to 12 (spec 11): the earlier steps that must have nothing left to write before a step runs. */
export const DEPLOY_STEP_NEEDS: Readonly<Record<string, readonly string[]>> = {
  'profile-athletes': ['athlete-name'],
  'past-registrations': ['profile-athletes'],
  'match-backfill': ['past-registrations'],
  duplicates: ['athlete-name', 'profile-athletes', 'past-registrations'],
  status: ['athlete-name', 'profile-athletes', 'past-registrations'],
};

/** The first needed step that still has work, with its count; null when `step` may run. */
export async function blockingStep(step: string, pending: (step: string) => Promise<number>): Promise<{ step: string; left: number } | null> {
  for (const previous of DEPLOY_STEP_NEEDS[step] ?? []) {
    const left = await pending(previous);
    if (left > 0) return { step: previous, left };
  }
  return null;
}
