import { expandOccurrences } from '../../api/calendar-event/services/expand';
import type { CalendarWindow } from '../groups/occurrences';
import type { GroupRecord, SectionRecord } from '../groups/types';
import type { BreakImpact, ImpactGroup, ImpactSection } from './break-impact-copy';

export type { BreakImpact, ImpactGroup, ImpactSection } from './break-impact-copy';
export { impactTitle, groupLine, breakListLine } from './break-impact-copy';

const byOrder = <T extends { order: number | null; name: string }>(a: T, b: T): number =>
  (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name, 'ro');

/**
 * Per active group, the held sessions in from..to. The window is expanded WITHOUT its breaks, so a break that is already
 * saved (or being edited) never hides the sessions it cancels; a moved date holds, a cancelled one does not count.
 */
export function breakImpact(w: CalendarWindow, groups: GroupRecord[], sections: SectionRecord[], from: string, to: string): BreakImpact {
  const counts = new Map<string, number>();
  for (const o of expandOccurrences(w.events, [], from, to)) {
    if (!o.groupId || (o.status !== 'scheduled' && o.status !== 'override')) continue;
    counts.set(o.groupId, (counts.get(o.groupId) ?? 0) + 1);
  }
  const active = groups.filter((g) => g.active).sort(byOrder);
  return {
    sections: [...sections].sort(byOrder).flatMap((s): ImpactSection[] => {
      const own = active.filter((g) => g.sectionId === s.id).map((g): ImpactGroup => ({ id: g.id, name: g.name, sessions: counts.get(g.id) ?? 0 }));
      return own.length ? [{ id: s.id, name: s.name, kind: s.kind, groups: own }] : [];
    }),
  };
}
