import type { FilterChoice } from '../ui-filters';
import { PERIOD_COPY } from '../presence/copy/prezenta-ui';
import type { PrezentaQuery } from './routes';

/** Same shape as the admin `FilterSection`. */
export type FilterSection = { key: string; label: string; options: FilterChoice[]; selected: string[]; single?: boolean; allLabel?: string | null };
export type FilterGroup = { id: string; name: string; sectionId: string };

/** The two sections of the Filtre button: Secțiune (one) and Grupă (several, the chosen section's groups only). */
export function prezentaFilterSections(q: Pick<PrezentaQuery, 'sectiune' | 'grupa'>, groups: FilterGroup[]): FilterSection[] {
  const sectionIds = [...new Set(groups.map((g) => g.sectionId))];
  const inSection = groups.filter((g) => q.sectiune === null || g.sectionId === q.sectiune);
  return [
    {
      key: 'sectiune', label: PERIOD_COPY.filters.section, single: true,
      options: sectionIds.map((id) => ({ value: id, label: id })), selected: q.sectiune !== null && sectionIds.includes(q.sectiune) ? [q.sectiune] : [],
    },
    {
      key: 'grupa', label: PERIOD_COPY.filters.group,
      options: inSection.map((g) => ({ value: g.id, label: g.name })), selected: q.grupa.filter((id) => inSection.some((g) => g.id === id)),
    },
  ];
}
