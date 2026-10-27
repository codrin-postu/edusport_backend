import { currentSeason } from './season-pick';
import { byGroupOrder, orderedSections } from './sections';
import { currentSeries } from './series';
import type { EventRecord, GroupRecord, GroupStore, SeasonRecord } from './types';

/** GET /api/club/schedule (spec 8.3, 9.1, W20): the notebook data, public and active school groups only, no private data. */
export type ScheduleSlot = { start: string; end: string; groups: string[] };
export type PublicSchedule = { section: { name: string; slug: string }; slots: ScheduleSlot[] }[];

export function scheduleSlots(groups: GroupRecord[], events: EventRecord[], season: SeasonRecord, today: string): ScheduleSlot[] {
  const slots = new Map<string, ScheduleSlot>();
  for (const g of [...groups].sort(byGroupOrder)) {
    for (const s of currentSeries(events, g.id, season, today)) {
      const slot = slots.get(`${s.startTime}-${s.endTime}`) ?? { start: s.startTime, end: s.endTime, groups: [] };
      if (!slot.groups.includes(g.name)) slot.groups.push(g.name);
      slots.set(`${s.startTime}-${s.endTime}`, slot);
    }
  }
  return [...slots.values()].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
}

export async function readPublicSchedule(store: GroupStore, today: string): Promise<PublicSchedule> {
  const [seasons, sections, groups, events] = await Promise.all([store.seasons(), store.sections(), store.groups(), store.events()]);
  const season = currentSeason(seasons);
  if (!season) return [];
  return orderedSections(sections)
    .filter((s) => s.kind === 'school' && s.publicPage)
    .map((s) => ({
      section: { name: s.name, slug: s.slug },
      slots: scheduleSlots(groups.filter((g) => g.sectionId === s.id && g.active && g.programPublic), events, season, today),
    }));
}
