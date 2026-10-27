import { nameKey } from '../../migrate/names';
import { P4_ACTIONS } from '../history-lines';
import { classView, seriesText, seriesView } from '../series';
import type { EventRecord, GroupRecord, SectionRecord } from '../types';
import { matchOne } from './coaches';

/** Step 5 (spec 4): unlinked `curs` events whose title, without "Antrenament:" or "Curs", names ONE group get `group` set. Pure. */
export const SKIP_NAMES: readonly string[] = ['Grupa A', 'Weekend curs', 'Performanță', 'Grupa Mică', 'Grupa Mare'];
export type EventLink = { eventId: string; title: string; groupId: string; groupName: string };
export type LinkPlan = { link: EventLink[]; skipped: string[]; unmatched: string[] };

const PREFIX = /^\s*(antrenament\s*:|curs\b)\s*/i;
const SKIP: ReadonlySet<string> = new Set(SKIP_NAMES.map(nameKey));
export const bareTitle = (title: string): string => title.replace(PREFIX, '').trim();

/** Never links to a Școala group: school events are `scoala` (W9), so a `curs` naming one stays unmatched. */
export function planEventLinks(events: EventRecord[], allGroups: GroupRecord[], sections: SectionRecord[]): LinkPlan {
  const schools = new Set(sections.filter((s) => s.kind === 'school').map((s) => s.id));
  const groups = allGroups.filter((g) => !schools.has(g.sectionId ?? ''));
  const plan: LinkPlan = { link: [], skipped: [], unmatched: [] };
  for (const e of events.filter((x) => !x.groupId && x.type === 'curs')) {
    const name = bareTitle(e.title);
    const g = SKIP.has(nameKey(name)) ? null : matchOne(groups, name);
    if (SKIP.has(nameKey(name))) plan.skipped.push(e.title);
    else if (!g) plan.unmatched.push(e.title);
    else plan.link.push({ eventId: e.id, title: e.title, groupId: g.id, groupName: g.name });
  }
  return plan;
}

/** Decided 1: the line the group page writes when the program is added there. */
export function linkLine(e: EventRecord): { action: string; changes: Record<string, unknown> } {
  const series = seriesView(e);
  if (series) return { action: P4_ACTIONS.programAdded, changes: { series: seriesText(series) } };
  const one = classView(e);
  return { action: P4_ACTIONS.classAdded, changes: { date: one?.date ?? null, startTime: one?.startTime ?? null, durationMin: one?.durationMin ?? null } };
}
