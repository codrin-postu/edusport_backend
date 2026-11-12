import { addDays } from '../../groups/dates';
import { readGroupProgram } from '../../groups/program-read';
import { daysSpoken } from '../../groups/program-text';
import { currentSeason } from '../../groups/season-pick';
import { seasonBounds } from '../../groups/series';
import type { GroupRecord, SectionRecord } from '../../groups/types';
import type { MembershipRow, SeasonRow } from '../../athletes/store';
import { isAnonymized } from '../../personal-data/anonymize-plan';
import { mainGroupOn } from '../../presence/attendance/roster';
import type { SportivPath } from './api-types';
import { badges, type BadgeInput } from './badges';
import { skaterOf } from './competitions';
import type { SportivContext } from './context';
import { toPath } from './views';

const monthOf = (date: string): string => date.slice(0, 7);

/** The next level: the active group of the same section with the next higher `order`; null without one. */
export function nextLevel(now: GroupRecord, groups: GroupRecord[]): GroupRecord | null {
  if (now.order === null) return null;
  const higher = groups.filter((g) => g.active && g.sectionId === now.sectionId && g.order !== null && g.order > (now.order as number));
  return higher.sort((a, b) => (a.order as number) - (b.order as number))[0] ?? null;
}

type Run = { seasonId: string; groupId: string; from: string; to: string };

/** Main memberships as runs of dates: one per season and group, consecutive or overlapping memberships merged, open ends at the season bounds. */
function mainRuns(memberships: MembershipRow[], seasons: SeasonRow[]): Run[] {
  const runs: Run[] = [];
  const mains = memberships.filter((m) => m.isMain);
  for (const key of new Set(mains.map((m) => `${m.seasonId}|${m.groupId}`))) {
    const [seasonId, groupId] = key.split('|');
    const season = seasons.find((s) => s.id === seasonId);
    if (!season) continue;
    const bounds = seasonBounds(season);
    const spans = mains.filter((m) => m.seasonId === seasonId && m.groupId === groupId)
      .map((m) => ({ from: m.from ?? bounds.start, to: m.to ?? bounds.end })).sort((a, b) => a.from.localeCompare(b.from));
    for (const s of spans) {
      const last = runs.at(-1);
      if (last && last.seasonId === seasonId && last.groupId === groupId && s.from <= addDays(last.to, 1)) last.to = s.to > last.to ? s.to : last.to;
      else runs.push({ seasonId, groupId, from: s.from, to: s.to });
    }
  }
  return runs;
}

/**
 * Earlier main groups, newest first, one per season and group; the run of `currentId` in the latest season is the level now and left out.
 * `today`: a run that starts after it (a dated move not yet in effect) is not "earlier" and is left out.
 */
export function earlierLevels(
  memberships: MembershipRow[], seasons: SeasonRow[], groups: GroupRecord[], currentId: string | null, today?: string,
): { groupName: string; from: string; to: string }[] {
  const runs = mainRuns(memberships, seasons).filter((r) => today === undefined || r.from <= today);
  const latest = runs.map((r) => seasons.find((s) => s.id === r.seasonId)?.label ?? '').sort().at(-1);
  return runs
    .filter((r) => !(r.groupId === currentId && seasons.find((s) => s.id === r.seasonId)?.label === latest))
    .sort((a, b) => b.from.localeCompare(a.from))
    .flatMap((r) => {
      const group = groups.find((g) => g.id === r.groupId);
      return group ? [{ groupName: group.name, from: monthOf(r.from), to: monthOf(r.to) }] : [];
    });
}

/** "Sâ și Du, 11:00, cu Virgil Pascu": the first running series of the group and its coaches. Null without a series. */
async function programOf(c: SportivContext, group: GroupRecord, seasonLabel: string): Promise<string | null> {
  const [program, team] = await Promise.all([readGroupProgram(c.groups.store, group.id, seasonLabel, c.today), c.groups.store.teamMembers()]);
  const series = program?.series[0];
  if (!series) return null;
  const names = team.filter((t) => group.coachIds.includes(t.id)).map((t) => t.name);
  const coaches = names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} și ${names[names.length - 1]}`;
  return `${daysSpoken(series.days)}, ${series.startTime}${coaches ? `, cu ${coaches}` : ''}`;
}

/** Months with a saved session of a main group while the athlete was in it, per season, and the months with a presence. */
async function seasonFacts(c: SportivContext, athleteId: string, memberships: MembershipRow[], seasons: SeasonRow[], presenceDates: string[]): Promise<BadgeInput['seasons']> {
  const store = c.presence.store;
  const runs = mainRuns(memberships, seasons);
  const present = new Set(presenceDates.map(monthOf));
  return Promise.all(seasons.map(async (season) => {
    const months = new Set<string>();
    for (const run of runs.filter((r) => r.seasonId === season.id)) {
      for (const s of await store.sessions({ groupId: run.groupId, from: run.from, to: run.to })) months.add(monthOf(s.date));
    }
    const { start, end } = seasonBounds(season);
    return { months: [...months].sort(), presentMonths: new Set([...present].filter((m) => m >= monthOf(start) && m <= monthOf(end))), finished: end < c.today };
  }));
}

/** Parcurs (spec 6.6): the level now, the next one, earlier main groups and the badges (all time). Callers check that the holder holds the athlete. */
export async function readPath(c: SportivContext, athleteId: string): Promise<SportivPath> {
  const store = c.presence.store;
  const athlete = await store.athlete(athleteId);
  if (!athlete || isAnonymized(athlete)) throw new Error('sportiv path: athlete not found');
  const [seasons, memberships, groups, sections, attendances, lessons, skater] = await Promise.all([
    store.seasons(), store.memberships({ athleteId }), store.groups(), store.sections(),
    store.attendances({ athleteId }), store.lessons({ athleteId }), skaterOf(c, athleteId),
  ]);
  const presenceDates = [
    ...attendances.filter((r) => r.grup || r.uscat).map((r) => r.sessionDate),
    ...lessons.filter((l) => l.state === 'saved' && l.present === true).map((l) => l.date),
  ];
  const competitions = skater ? await c.competitions.count(skater).catch(() => null) : null;

  const season = currentSeason(seasons);
  const nowGroup = season ? groups.find((g) => g.id === mainGroupOn(memberships, athleteId, season.id, c.today)) ?? null : null;
  const section: SectionRecord | undefined = sections.find((s) => s.id === nowGroup?.sectionId);
  let now: SportivPath['now'] = null;
  if (season && nowGroup) {
    const since = mainRuns(memberships, seasons).find((r) => r.seasonId === season.id && r.groupId === nowGroup.id && r.from <= c.today && r.to >= c.today);
    now = {
      groupName: nowGroup.name, since: monthOf(since?.from ?? seasonBounds(season).start), location: section?.locationName ?? null,
      program: await programOf(c, nowGroup, season.label),
    };
  }
  const next = nowGroup ? nextLevel(nowGroup, groups) : null;
  return toPath({
    now, next: next ? { groupName: next.name } : null,
    before: earlierLevels(memberships, seasons, groups, nowGroup?.id ?? null, c.today),
    badges: badges({ presenceDates, competitions, seasons: await seasonFacts(c, athleteId, memberships, seasons, presenceDates) }),
  });
}
