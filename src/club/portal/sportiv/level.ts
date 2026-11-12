import type { GroupRecord, SectionRecord } from '../../groups/types';
import type { Level, Promotion } from './api-types';

export function levelOf(group: GroupRecord, section: SectionRecord, location: string | null): Level {
  return { groupId: group.id, groupName: group.name, sectionName: section.name, section: section.kind, location };
}

/** A later level: a higher `order` in the same section, or a move from Școala to Club (spec 9, S24, S37). */
function isLater(from: GroupRecord, to: GroupRecord, sections: SectionRecord[]): boolean {
  const fromSection = sections.find((s) => s.id === from.sectionId);
  const toSection = sections.find((s) => s.id === to.sectionId);
  if (!fromSection || !toSection) return false;
  if (fromSection.id === toSection.id) return from.order !== null && to.order !== null && to.order > from.order;
  return fromSection.kind === 'school' && toSection.kind === 'club';
}

/**
 * `seen`: the group id stored on the access row. `store` is the value to write silently (the first read, or a change that is not a promotion), null for nothing;
 * a promotion is stored only when the app confirms it was shown.
 */
export function promotionFor(seen: string | null, now: GroupRecord | null, groups: GroupRecord[], sections: SectionRecord[]): { promotion: Promotion | null; store: string | null } {
  if (!now || seen === now.id) return { promotion: null, store: null };
  const before = seen === null ? undefined : groups.find((g) => g.id === seen);
  if (!before) return { promotion: null, store: now.id };
  return isLater(before, now, sections) ? { promotion: { from: before.name, to: now.name }, store: null } : { promotion: null, store: now.id };
}
