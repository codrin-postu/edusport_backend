import { NEW_SEASON_COPY, athletesText } from '../copy';
import type { StartRequest } from './plan';
import type { ChildMain } from './preview';
import type { StartAthlete, StartData, StartGroup, StartSection } from './start-data';

/** Step 2 of "Începe sezonul" (10.2, W26). Pure. */
export type Tick = { members: boolean; program: boolean; excluded: string[] };
export type Ticks = Record<string, Tick>;
export type TickKey = 'members' | 'program';

export const membersEnabled = (g: StartGroup): boolean => g.members > 0;
export const programEnabled = (g: StartGroup): boolean => g.programState === 'ok';
const enabled = (g: StartGroup, key: TickKey): boolean => (key === 'members' ? membersEnabled(g) : programEnabled(g));

export const initialTicks = (data: StartData): Ticks =>
  Object.fromEntries(data.sections.flatMap((s) => s.groups).map((g) => [g.groupId, { members: g.defaultMembers, program: g.defaultProgram, excluded: [] }]));

export function headerState(section: StartSection, ticks: Ticks, key: TickKey): { checked: boolean; indeterminate: boolean; disabled: boolean } {
  const rows = section.groups.filter((g) => enabled(g, key));
  const on = rows.filter((g) => ticks[g.groupId]?.[key]).length;
  return { checked: rows.length > 0 && on === rows.length, indeterminate: on > 0 && on < rows.length, disabled: rows.length === 0 };
}

export function setSection(section: StartSection, ticks: Ticks, key: TickKey, on: boolean): Ticks {
  const next = { ...ticks };
  for (const g of section.groups.filter((x) => enabled(x, key))) next[g.groupId] = { ...next[g.groupId], [key]: on, excluded: key === 'members' && on ? [] : next[g.groupId].excluded };
  return next;
}

/** Ticking "Copiază sportivii" ticks every active child again (W26). */
export function toggleGroup(ticks: Ticks, g: StartGroup, key: TickKey): Ticks {
  const t = ticks[g.groupId];
  const on = !t[key];
  return { ...ticks, [g.groupId]: { ...t, [key]: on, excluded: key === 'members' && on ? [] : t.excluded } };
}

export function toggleChild(ticks: Ticks, groupId: string, athleteId: string): Ticks {
  const t = ticks[groupId];
  const excluded = t.excluded.includes(athleteId) ? t.excluded.filter((id) => id !== athleteId) : [...t.excluded, athleteId];
  return { ...ticks, [groupId]: { ...t, excluded } };
}

export const startBody = (data: StartData, ticks: Ticks): StartRequest => ({
  groups: data.sections.flatMap((s) => s.groups).map((g) => ({
    groupId: g.groupId, copyMembers: ticks[g.groupId].members, copyProgram: ticks[g.groupId].program, excludeAthleteIds: ticks[g.groupId].excluded,
  })),
});

/** "10 sportivi, 1 inactiv" (the "În <sezon>" column). */
export const inLine = (g: StartGroup): string => `${athletesText(g.members)}${g.inactive ? NEW_SEASON_COPY.inactiveSuffix(g.inactive) : ''}`;

export function programCell(g: StartGroup, next: string): string {
  if (g.programState === 'exists') return NEW_SEASON_COPY.hasProgram(next);
  return g.programState === 'none' ? NEW_SEASON_COPY.noProgram : g.program;
}

/** "Grupa principală în <next>" of one child in one group's list, with the muted second line when useful. */
export function childMain(child: StartAthlete, groupId: string, mains: Record<string, ChildMain>, current: string): { main: string; note: string | null } {
  if (child.inactive) return { main: '', note: NEW_SEASON_COPY.childInactive };
  const m = mains[child.athleteId];
  if (!m) return { main: NEW_SEASON_COPY.childNoGroup, note: null };
  if (m.kept) return { main: m.groupName, note: m.groupId === groupId ? null : NEW_SEASON_COPY.childKept(current) };
  return { main: m.groupName, note: m.previousName ? NEW_SEASON_COPY.childChanged(current, m.previousName) : null };
}

/** Phone card line (10.2): "<n> sportivi în 2026-2027[, <k> inactiv], <program>". */
export const phoneLine = (g: StartGroup, current: string, next: string): string =>
  `${NEW_SEASON_COPY.phoneCard(g.members, current)}${g.inactive ? NEW_SEASON_COPY.inactiveSuffix(g.inactive) : ''}, ${programCell(g, next)}`;

/** Phone: "Principală: <grupă>" under a child, or the inactive note. */
export const childPhoneLine = (m: { main: string; note: string | null }): string => (m.main ? NEW_SEASON_COPY.childMainShort(m.main) : m.note ?? '');
