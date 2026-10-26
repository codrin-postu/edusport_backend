import { ACS_RANK, type AcsState } from '../acs';
import type { FieldChange } from '../admin-result';
import { ATHLETE_FIELDS, athleteChanges, isDataIncomplete, type AthleteField, type AthleteStatus, type AthleteValues } from '../athlete-data';

/** "Unește cu alt sportiv" (spec 6.6, d39): everything moves to the kept record; no undo. */
export type MergeSide = {
  id: string;
  name: string;
  values: AthleteValues;
  status: AthleteStatus;
  profile: { id: string; slug: string; previousSlugs: string[] } | null;
  memberships: { id: string; groupId: string; seasonId: string; isMain: boolean }[];
  acs: { id: string; seasonId: string; state: AcsState }[];
};

export type MergePlan = {
  values: AthleteValues;
  fieldChanges: Record<string, FieldChange>;
  dataIncomplete: boolean;
  memberships: { move: { id: string; isMain: boolean }[]; remove: string[] };
  acs: { move: string[]; raise: { id: string; state: AcsState }[]; remove: string[] };
  profile: { moveId: string | null; deleteId: string | null; previousSlugs: string[] | null; finalId: string | null };
};

export function mergeDiffering(kept: AthleteValues, removed: AthleteValues): AthleteField[] {
  return ATHLETE_FIELDS.filter((f) => (kept[f] ?? '') !== (removed[f] ?? ''));
}

function planMemberships(kept: MergeSide, removed: MergeSide): MergePlan['memberships'] {
  const plan: MergePlan['memberships'] = { move: [], remove: [] };
  for (const m of removed.memberships) {
    const sameSeason = kept.memberships.filter((k) => k.seasonId === m.seasonId);
    if (sameSeason.some((k) => k.groupId === m.groupId)) plan.remove.push(m.id);
    else plan.move.push({ id: m.id, isMain: sameSeason.length === 0 ? m.isMain : false });
  }
  return plan;
}

function planAcs(kept: MergeSide, removed: MergeSide): MergePlan['acs'] {
  const plan: MergePlan['acs'] = { move: [], raise: [], remove: [] };
  for (const r of removed.acs) {
    const k = kept.acs.find((x) => x.seasonId === r.seasonId);
    if (!k) {
      plan.move.push(r.id);
      continue;
    }
    plan.remove.push(r.id);
    if (ACS_RANK[r.state] > ACS_RANK[k.state]) plan.raise.push({ id: k.id, state: r.state });
  }
  return plan;
}

function planProfile(kept: MergeSide, removed: MergeSide): MergePlan['profile'] {
  if (kept.profile && removed.profile) {
    const previousSlugs = [...new Set([...kept.profile.previousSlugs, removed.profile.slug, ...removed.profile.previousSlugs])];
    return { moveId: null, deleteId: removed.profile.id, previousSlugs, finalId: kept.profile.id };
  }
  if (removed.profile) return { moveId: removed.profile.id, deleteId: null, previousSlugs: null, finalId: removed.profile.id };
  return { moveId: null, deleteId: null, previousSlugs: null, finalId: kept.profile?.id ?? null };
}

/** The kept record's status stays (N6, option A). */
export function planMerge(kept: MergeSide, removed: MergeSide, take: AthleteField[]): MergePlan {
  const values = { ...kept.values };
  for (const field of take) values[field] = removed.values[field];
  return {
    values,
    fieldChanges: athleteChanges(kept.values, values),
    dataIncomplete: isDataIncomplete(values),
    memberships: planMemberships(kept, removed),
    acs: planAcs(kept, removed),
    profile: planProfile(kept, removed),
  };
}
