import type { GroupPage, MemberRow } from '../groups/api-types';
import { GRUPE_COPY, athletesText } from '../groups/copy';
import { countWords } from '../ro-count';

/** The group page (spec 6.1, 6.2). Pure. */
export type GroupTab = 'sportivi' | 'program' | 'istoric';
export type MemberAction = 'move' | 'addAlso' | 'remove';

/** "Școala de patinaj, Virgil Pascu, lista Standard, 11 sportivi"; "Fără antrenor"; no list part without a price list. */
export function subtitle(p: GroupPage): string {
  const coaches = p.coaches.length ? p.coaches.map((c) => c.name).join(', ') : GRUPE_COPY.noCoach;
  return [p.section?.name ?? '', coaches, p.priceList ? `lista ${p.priceList.name}` : '', athletesText(p.members.length)].filter(Boolean).join(', ');
}

export const groupTabs = (p: GroupPage): { id: GroupTab; label: string; count?: number }[] => [
  { id: 'sportivi', label: GRUPE_COPY.tabMembers, count: p.members.length },
  { id: 'program', label: GRUPE_COPY.tabProgram },
  { id: 'istoric', label: GRUPE_COPY.tabHistory, count: p.historyCount },
];

export const ageText = (age: number | null): string => (age === null ? '' : countWords(age, 'an', 'ani'));
export const mainText = (m: MemberRow): string => (m.isMain ? GRUPE_COPY.yes : GRUPE_COPY.no);
export const othersText = (m: MemberRow): string | null =>
  m.others.length ? m.others.map((o) => (o.isMain ? `${o.name}${GRUPE_COPY.mainMark}` : o.name)).join(', ') : null;

/** Phone card: "<n> ani, principală, și în <grupă>", parts present only when true. */
export const phoneMemberLine = (m: MemberRow): string =>
  [ageText(m.age), m.isMain ? GRUPE_COPY.phoneMain : '', ...m.others.map((o) => GRUPE_COPY.phoneAlso(o.name))].filter(Boolean).join(', ');

export const memberMenuItems = (): { key: MemberAction; label: string; danger: boolean }[] => [
  { key: 'move', label: GRUPE_COPY.rowMove, danger: false },
  { key: 'addAlso', label: GRUPE_COPY.rowAddAlso, danger: false },
  { key: 'remove', label: GRUPE_COPY.rowRemove, danger: true },
];

/** "Adaugă sportivi": athletes already in the group are not listed (W3). */
export const addCandidates = <T extends { athleteId: string }>(rows: T[], members: MemberRow[]): T[] => rows.filter((r) => !members.some((m) => m.athleteId === r.athleteId));
