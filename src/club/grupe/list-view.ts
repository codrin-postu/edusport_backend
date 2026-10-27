import type { GroupChoice, GroupListPage, GroupListRow, UnassignedRow } from '../groups/api-types';
import { GRUPE_COPY, athletesText, groupsText } from '../groups/copy';

/** Grupe list (spec 5.2, 5.3). Pure. */
export const countLine = (p: Pick<GroupListPage, 'athletes' | 'groups'>): string => `${athletesText(p.athletes)} în ${groupsText(p.groups)}`;
export const coachesText = (r: GroupListRow): string | null => (r.coaches.length ? r.coaches.join(', ') : null);
export const phoneSummary = (r: GroupListRow): string => `${r.program.length ? r.program.join(', ') : GRUPE_COPY.noProgram}, ${athletesText(r.members)}`;
export const tabItems = (p: GroupListPage): { id: string; label: string; count: number }[] => p.tabs.map((t) => ({ id: t.slug, label: t.label, count: t.count }));
/** W5: writes only on a season that is not past. */
export const writable = (p: { season: { past: boolean } | null }): boolean => !!p.season && !p.season.past;
export const seasonOptions = (p: GroupListPage): { value: string; label: string }[] => p.seasons.map((s) => ({ value: s.label, label: GRUPE_COPY.season(s.label) }));

export const groupOptions = (groups: GroupChoice[], exceptId: string | null): { value: string; label: string; hint: string }[] =>
  groups.filter((g) => g.documentId !== exceptId).map((g) => ({ value: g.documentId, label: g.name, hint: g.sectionName }));

/** The "În" list of "Adaugă și în grupă": this group and the groups the athlete is already in are left out (a group is told by its name here, the row carries names). */
export const joinableGroups = (groups: GroupChoice[], exceptId: string, alreadyIn: { name: string }[]): GroupChoice[] =>
  groups.filter((g) => g.documentId !== exceptId && !alreadyIn.some((o) => o.name === g.name));

/** A join or an allocation that wrote nothing (the athlete got a group meanwhile, or was in it already) is a stale page, not a success. */
export const wroteNothing = (answer: { added: number }): boolean => answer.added === 0;

export type Picks = Record<string, string | null>;
export const initialPicks = (rows: UnassignedRow[]): Picks => Object.fromEntries(rows.map((r) => [r.athleteId, r.proposedGroupId]));

/** "Alocă toți în grupele propuse": every row with a group chosen (proposed or changed); rows without one stay (W6). */
export const allocateItems = (rows: UnassignedRow[], picks: Picks): { athleteId: string; groupId: string }[] =>
  rows.flatMap((r) => (picks[r.athleteId] ? [{ athleteId: r.athleteId, groupId: picks[r.athleteId] as string }] : []));
