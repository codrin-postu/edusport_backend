import { birthDateForPicker } from '../athlete-data';
import { HISTORY_ACTIONS } from '../history-text';
import { normalizeSeasonLabel } from '../season';
import type { AthleteCard, GroupSection } from './api-types';
import type { AthleteRow, ClubStore, GroupRow, HistoryRow, MembershipRow, RegistrationRow, SeasonRow, SectionRow } from './store';

/** The season label of a registration: its Sezon link, else its season text. */
export function registrationSeasonLabel(r: RegistrationRow, seasons: SeasonRow[]): string | null {
  return seasons.find((s) => s.id === r.seasonId)?.label ?? normalizeSeasonLabel(r.season);
}

function lastGroup(own: MembershipRow[], groups: Map<string, string>, seasons: Map<string, string>): AthleteCard['lastGroup'] {
  const dated = own.map((m) => ({ m, season: seasons.get(m.seasonId) ?? '' })).sort((a, b) => b.season.localeCompare(a.season) || Number(b.m.isMain) - Number(a.m.isMain));
  const top = dated[0];
  return top ? { name: groups.get(top.m.groupId) ?? '', season: top.season } : null;
}

/** "Ultima înscriere: <sezon>" (gaps #5): linked registrations, and those an athlete was made from at deploy. */
function pastSeasons(entries: HistoryRow[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const e of entries) {
    const regs = Array.isArray(e.changes.registrations) ? (e.changes.registrations as { season?: unknown }[]) : [];
    const seasons = regs.map((r) => (typeof r.season === 'string' ? r.season : '')).filter(Boolean);
    out.set(e.subjectId, [...(out.get(e.subjectId) ?? []), ...seasons]);
  }
  return out;
}

const newest = (labels: (string | null)[]): string | null => labels.filter((l): l is string => !!l).sort().pop() ?? null;

export async function cardMaker(store: ClubStore, loadedRegistrations?: RegistrationRow[]): Promise<(a: AthleteRow) => AthleteCard> {
  const [memberships, groups, seasons, registrations, made] = await Promise.all([
    store.memberships(), store.groups(), store.seasons(), loadedRegistrations ?? store.registrations(), store.historyByAction(HISTORY_ACTIONS.createdFromRegistrations),
  ]);
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const seasonLabel = new Map(seasons.map((s) => [s.id, s.label]));
  const past = pastSeasons(made);
  return (a) => ({
    documentId: a.id,
    name: a.name ?? '',
    birthDate: birthDateForPicker(a.birthDate),
    lastGroup: lastGroup(memberships.filter((m) => m.athleteId === a.id), groupName, seasonLabel),
    lastRegistrationSeason: newest([...registrations.filter((r) => r.athleteId === a.id).map((r) => registrationSeasonLabel(r, seasons)), ...(past.get(a.id) ?? [])]),
    contactName: a.contactName,
    status: a.status,
  });
}

const byOrder = <T extends { order: number | null; name: string }>(rows: T[]): T[] =>
  [...rows].sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999) || a.name.localeCompare(b.name, 'ro'));

/** Group picker (spec 4.3, gaps #28): the registration's school, then Club; active groups in their own order. */
export function groupOptions(sectionId: string | null, sections: SectionRow[], groups: GroupRow[]): GroupSection[] {
  const school = sections.filter((s) => s.id === sectionId && s.kind === 'school');
  const clubs = byOrder(sections.filter((s) => s.kind === 'club'));
  return [...school, ...clubs]
    .map((s) => ({ sectionId: s.id, sectionName: s.name, groups: byOrder(groups.filter((g) => g.sectionId === s.id && g.active)).map((g) => ({ documentId: g.id, name: g.name })) }))
    .filter((s) => s.groups.length > 0);
}
