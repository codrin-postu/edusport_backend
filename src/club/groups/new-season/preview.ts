import { ARROW, NEW_SEASON_COPY, startToast, summaryText } from '../copy';
import { shortDate } from '../dates';
import { sectionLabel } from '../sections';
import { seriesStart, targetSeriesOf, type StartFacts } from './facts';
import type { MainOutcome, StartPlan } from './plan';

/** Step 3 of the window and the toast (10.2, 10.5, W29). Pure; counts come from the plan the apply uses. */
export type Tile = { label: string; value: string; hint: string };
export type PreviewLine = { bold: string; rest: string };
export type ChildMain = { groupId: string; groupName: string; previousName: string | null; kept: boolean };
export type StartPreview = { summary: string; tiles: Tile[]; lines: PreviewLine[]; warning: string | null; mains: Record<string, ChildMain> };
export type StartResult = { season: string; copied: { athletes: number; groups: number; series: number }; unassigned: number; toast: string };

const C = NEW_SEASON_COPY;
const nameOf = (f: StartFacts, id: string | null): string => f.groups.find((g) => g.id === id)?.name ?? '';
const copiedGroupIds = (plan: StartPlan): string[] => [...new Set(plan.members.map((m) => m.groupId))];
const copiedAthletes = (plan: StartPlan): number => new Set(plan.members.map((m) => m.athleteId)).size;
const programGroups = (plan: StartPlan): number => new Set(plan.series.map((s) => s.groupId)).size;

function oneSection(f: StartFacts, groupIds: string[]): string | null {
  const ids = new Set(groupIds.map((id) => f.groups.find((g) => g.id === id)?.sectionId));
  const section = ids.size === 1 ? f.sections.find((s) => ids.has(s.id)) : undefined;
  return section ? sectionLabel(section, f.sections) : null;
}

function tiles(f: StartFacts, plan: StartPlan): Tile[] {
  const groups = copiedGroupIds(plan);
  return [
    { label: C.tileGroups, value: String(f.groups.filter((g) => g.active).length), hint: C.tileGroupsHint(f.target.label) },
    { label: C.tileAthletes, value: String(copiedAthletes(plan)), hint: C.tileAthletesHint(groups.length, oneSection(f, groups)) },
    { label: C.tileSeries, value: String(plan.series.length), hint: C.tileSeriesHint(shortDate(seriesStart(f))) },
    { label: C.tileUnassigned, value: String(plan.unassignedAfter), hint: C.tileUnassignedHint(f.current.label) },
  ];
}

function mainLines(f: StartFacts, mains: MainOutcome[]): PreviewLine[] {
  const changed = mains.filter((m) => m.previousGroupId && m.previousGroupId !== m.groupId);
  const kept = mains.filter((m) => m.previousGroupId === m.groupId).sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  const lines: PreviewLine[] = [];
  if (changed.length) lines.push({ bold: C.mainChangesBold(changed.length), rest: changed.map((m) => ` ${m.name}: ${nameOf(f, m.previousGroupId)} ${ARROW} ${nameOf(f, m.groupId)}.`).join('') });
  if (kept.length) lines.push({ bold: C.mainKeptBold(kept.length), rest: C.mainKeptRest(kept[0].name, nameOf(f, kept[0].groupId)) });
  return lines;
}

function otherLines(f: StartFacts, plan: StartPlan): PreviewLine[] {
  const lines: PreviewLine[] = [];
  if (plan.inactive.length) lines.push({ bold: C.inactiveBold(plan.inactive.length), rest: ` ${plan.inactive.map((a) => a.name).join(', ')}.` });
  if (plan.unassignedAfter) lines.push({ bold: C.unassignedBold(plan.unassignedAfter), rest: C.unassignedRest(f.target.label, f.current.label) });
  if (plan.series.length) lines.push({ bold: C.programBold, rest: C.programRest(shortDate(plan.seriesFrom), shortDate(plan.seriesTo)) });
  lines.push({ bold: C.acsBold, rest: C.acsRest(f.target.label) });
  return lines;
}

/** W29: the warning when no school group will have a program in the new season (9.1 fallback). */
function schoolWarning(f: StartFacts, plan: StartPlan): string | null {
  const schools = new Set(f.sections.filter((s) => s.kind === 'school').map((s) => s.id));
  const covered = f.groups.some((g) => g.active && schools.has(g.sectionId ?? '') && (targetSeriesOf(f, g.id).length || plan.series.some((s) => s.groupId === g.id)));
  return covered ? null : C.schoolWarning(f.target.label);
}

const childMains = (f: StartFacts, mains: MainOutcome[]): Record<string, ChildMain> => Object.fromEntries(mains.map((m) => [m.athleteId, {
  groupId: m.groupId, groupName: nameOf(f, m.groupId), previousName: m.previousGroupId ? nameOf(f, m.previousGroupId) : null, kept: m.previousGroupId === m.groupId,
}]));

export function startPreview(f: StartFacts, plan: StartPlan): StartPreview {
  return {
    summary: summaryText({ athletes: copiedAthletes(plan), groups: copiedGroupIds(plan).length, programGroups: programGroups(plan), unassigned: plan.unassignedAfter, inactive: plan.inactive.length }),
    tiles: tiles(f, plan), lines: [...mainLines(f, plan.mains), ...otherLines(f, plan)], warning: schoolWarning(f, plan), mains: childMains(f, plan.mains),
  };
}

export function startResult(f: StartFacts, plan: StartPlan): StartResult {
  const athletes = copiedAthletes(plan);
  return {
    season: f.target.label, copied: { athletes, groups: copiedGroupIds(plan).length, series: plan.series.length }, unassigned: plan.unassignedAfter,
    toast: startToast(f.target.label, athletes, plan.series.length),
  };
}
