import { registrationSeasonLabel } from '../athletes/cards';
import type { AthleteRow, MembershipRow, RegistrationRow } from '../athletes/store';
import { isCurrentMembership } from '../group-membership';
import type { UnassignedPage, UnassignedRow } from './api-types';
import { sourceLine, type SourceKind } from './copy';
import { ageOnIso, pickSeason, previousSeason, seasonRef } from './season-pick';
import { groupChoices } from './sections';
import type { GroupRecord, GroupStore, SeasonRecord } from './types';

export type UnassignedFacts = {
  season: SeasonRecord; seasons: SeasonRecord[]; athletes: AthleteRow[]; memberships: MembershipRow[]; registrations: RegistrationRow[]; groups: GroupRecord[]; today: string;
};
type Prev = SeasonRecord | null;

const ELIGIBLE: ReadonlySet<string> = new Set(['nou', 'activ']);

function sourceKind(a: AthleteRow, f: UnassignedFacts, previous: Prev): SourceKind {
  if (f.registrations.some((r) => r.athleteId === a.id && registrationSeasonLabel(r, f.seasons) === f.season.label)) return 'registration';
  return previous && f.memberships.some((m) => m.athleteId === a.id && m.seasonId === previous.id) ? 'previous' : 'added';
}

/** Decided 8: last season's current main row, when that group is still active. */
function proposedGroup(a: AthleteRow, f: UnassignedFacts, previous: Prev): string | null {
  if (!previous) return null;
  const main = f.memberships.find((m) => m.athleteId === a.id && m.seasonId === previous.id && m.isMain && isCurrentMembership(m));
  const group = main ? f.groups.find((g) => g.id === main.groupId) : undefined;
  return group?.active ? group.id : null;
}

function unassignedRow(a: AthleteRow, f: UnassignedFacts, previous: Prev): UnassignedRow {
  return {
    athleteId: a.id, name: a.name ?? '',
    source: sourceLine(sourceKind(a, f, previous), previous?.label ?? null, ageOnIso(a.birthDate, f.today)),
    proposedGroupId: proposedGroup(a, f, previous),
  };
}

/** "Fără grupă" (5.3, W6): Nou or Activ athletes with no current membership in the season, by name. */
export function unassignedRows(f: UnassignedFacts): UnassignedRow[] {
  const placed = new Set(f.memberships.filter((m) => m.seasonId === f.season.id && isCurrentMembership(m)).map((m) => m.athleteId));
  const previous = previousSeason(f.season, f.seasons);
  return f.athletes
    .filter((a) => ELIGIBLE.has(a.status) && !placed.has(a.id))
    .map((a) => unassignedRow(a, f, previous))
    .sort((x, y) => x.name.localeCompare(y.name, 'ro'));
}

export async function unassignedFor(store: GroupStore, season: SeasonRecord, seasons: SeasonRecord[], today: string): Promise<UnassignedRow[]> {
  const [athletes, memberships, registrations, groups] = await Promise.all([store.athletes(), store.memberships(), store.registrations(), store.groups()]);
  return unassignedRows({ season, seasons, athletes, memberships, registrations, groups, today });
}

export async function readUnassigned(store: GroupStore, label: string | null, today: string): Promise<UnassignedPage> {
  const [seasons, sections, groups] = await Promise.all([store.seasons(), store.sections(), store.groups()]);
  const season = pickSeason(seasons, label);
  return {
    season: season ? seasonRef(season, seasons) : null,
    rows: season ? await unassignedFor(store, season, seasons, today) : [],
    groups: groupChoices(groups, sections),
  };
}
