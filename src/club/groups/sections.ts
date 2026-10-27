import type { GroupChoice } from './api-types';
import { SECTION_LABELS } from './copy';
import type { GroupRecord, SectionRecord } from './types';

const rank = (s: SectionRecord): number => (s.kind === 'school' ? 0 : 1);

/** Schools first, then Club, each in its order (5.2, 5.3). */
export const orderedSections = (sections: SectionRecord[]): SectionRecord[] =>
  [...sections].sort((a, b) => rank(a) - rank(b) || (a.order ?? 9999) - (b.order ?? 9999) || a.name.localeCompare(b.name, 'ro'));

/** "Școala de patinaj" while there is one school; with 2+ schools, each school's own name (W16). */
export function sectionLabel(section: SectionRecord, sections: SectionRecord[]): string {
  const schools = sections.filter((s) => s.kind === 'school').length;
  return section.kind === 'school' && schools === 1 ? SECTION_LABELS.school : section.name;
}

export const byGroupOrder = (a: GroupRecord, b: GroupRecord): number => (a.order ?? 9999) - (b.order ?? 9999) || a.name.localeCompare(b.name, 'ro');

/** Every active group, school first then Club, in their order; the section as the hint (5.3, 6.2). */
export function groupChoices(groups: GroupRecord[], sections: SectionRecord[]): GroupChoice[] {
  return orderedSections(sections).flatMap((s) =>
    groups.filter((g) => g.active && g.sectionId === s.id).sort(byGroupOrder).map((g) => ({ documentId: g.id, name: g.name, sectionName: sectionLabel(s, sections) })),
  );
}
