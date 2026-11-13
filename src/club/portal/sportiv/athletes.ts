import { ageOnIso, currentSeason } from '../../groups/season-pick';
import { isAnonymized } from '../../personal-data/anonymize-plan';
import { groupNameMap } from '../../presence/due/reads';
import { clubMonths, mainGroupToday, schoolDue } from '../../presence/due/settlement';
import type { PresenceStore } from '../../presence/store';
import type { SportivAthleteRow, SportivAthletes } from './api-types';
import type { SkaterRef } from '../coach/competitions';
import { skaterOf } from './competitions';
import type { SportivContext } from './context';

/** Same month and day one year earlier, as text (29 February becomes a day that never matches, which compares the same). */
const yearAgo = (today: string): string => `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`;

/**
 * Spec 5.3: every athlete is in the picker except an `inactiv` one that owes nothing and has no presence in the last 12 months
 * (a presence exactly 12 months ago still counts). Such an athlete stays reachable by URL while the access lives.
 */
export function inPicker(a: { status: string }, owes: boolean, lastPresence: string | null, today: string): boolean {
  if (a.status !== 'inactiv') return true;
  return owes || (lastPresence !== null && lastPresence >= yearAgo(today));
}

const firstWord = (name: string): string => name.split(/\s+/).find(Boolean) ?? name;

/** Whether the athlete owes anything (a Club month with money left, an unpaid Școala abonament) and the date of its last presence (a group or dry-land mark, or a held lesson). */
async function ledgerOf(store: PresenceStore, athleteId: string, groupNames: ReadonlyMap<string, string>, startDate: string | null): Promise<{ owes: boolean; lastPresence: string | null }> {
  const [attendances, lessons, payments, subscriptions] = await Promise.all([
    store.attendances({ athleteId }), store.lessons({ athleteId }), store.payments({ athleteId }), store.subscriptions({ athleteId }),
  ]);
  const owes = clubMonths({ attendances, lessons, payments, groupNames, startDate }).some((m) => m.left > 0) || schoolDue(subscriptions, payments).length > 0;
  const dates = [
    ...attendances.filter((a) => a.grup || a.uscat).map((a) => a.sessionDate),
    ...lessons.filter((l) => l.state === 'saved' && l.present === true).map((l) => l.date),
  ].sort();
  return { owes, lastPresence: dates.at(-1) ?? null };
}

/** The athletes the holder holds right now, by name, for the account menu and the picker. Built field by field. */
export async function readAthletes(c: SportivContext): Promise<SportivAthletes> {
  const store = c.presence.store;
  const held = new Set(c.holder.athleteIds);
  const season = currentSeason(await store.seasons());
  const [athletes, groups, sections, startDate, memberships] = await Promise.all([
    store.athletes(), store.groups(), store.sections(), store.attendanceStartDate(), season ? store.memberships({ seasonId: season.id }) : Promise.resolve([]),
  ]);
  const mains = mainGroupToday(memberships, groups, season?.id ?? null);
  const groupNames = groupNameMap(groups);
  const rows: SportivAthleteRow[] = [];
  const shown = athletes.filter((x) => held.has(x.id) && !isAnonymized(x));
  const skaters = new Map<string, SkaterRef>();
  for (const a of shown) { const skater = await skaterOf(c, a.id); if (skater) skaters.set(a.id, skater); }
  // A slug means skate-results; without one the athlete shows Concursuri only when it has hand-entered competitions (one read for all).
  const handRead = await c.results.many([...skaters.values()].filter((s) => !s.slug)).catch(() => new Map());
  const performance = (id: string): boolean => {
    const skater = skaters.get(id);
    if (!skater) return false;
    if (skater.slug) return true;
    const read = handRead.get(id);
    return !!read && 'value' in read && read.value.length > 0;
  };
  for (const a of shown) {
    const main = mains.get(a.id) ?? null;
    const { owes, lastPresence } = await ledgerOf(store, a.id, groupNames, startDate);
    const name = a.name ?? '';
    rows.push({
      id: a.id, name, firstName: firstWord(name), groupName: main?.name ?? null, age: ageOnIso(a.birthDate, c.today),
      section: sections.find((s) => s.id === main?.sectionId)?.kind ?? null,
      inPicker: inPicker(a, owes, lastPresence, c.today), performance: performance(a.id),
    });
  }
  return { athletes: rows.sort((x, y) => x.name.localeCompare(y.name, 'ro')) };
}
