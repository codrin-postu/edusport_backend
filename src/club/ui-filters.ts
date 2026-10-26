import { foldText } from './ui-select';

/**
 * Rules of the admin filter panel, filters-v3 layout (src/admin/ui/FilterPanel.tsx;
 * DECISIONS 2026-10-06 filters-v3). Pure: no DOM, no React.
 */

/** One option of a filter section. */
export interface FilterChoice {
  value: string;
  label: string;
}

export interface FilterSectionState {
  options: FilterChoice[];
  /** Chosen values; empty = everything ("Toate"). */
  selected: string[];
  /** One value at a time (radio rows). Default: several (checkbox rows). */
  single?: boolean;
  /** Overrides the text under the section name. */
  summary?: string;
}

/** Text under a section with nothing chosen (filters-v3). */
export const ALL_LABEL = 'Toate';
/** A section gets a search box only above this many options (filters-v3). */
export const SEARCH_ABOVE = 8;
/** Joins several chosen labels under the section name (plan 3-1, Needs decision 3). */
export const SUMMARY_JOIN = ', ';

/** Text under a section name: its own summary, "Toate" when nothing is chosen, else the chosen labels in option order. */
export function sectionSummary(s: FilterSectionState): string {
  if (s.summary !== undefined) return s.summary;
  const labels = s.options.filter((o) => s.selected.includes(o.value)).map((o) => o.label);
  return labels.length > 0 ? labels.join(SUMMARY_JOIN) : ALL_LABEL;
}

/** Selection after a click on an option: toggled in a multi section, the only one in a single section. */
export function toggleChoice(s: Pick<FilterSectionState, 'selected' | 'single'>, value: string): string[] {
  if (s.single) return [value];
  return s.selected.includes(value) ? s.selected.filter((v) => v !== value) : [...s.selected, value];
}

/** True when a section is long enough for a search box. */
export function needsSearch(optionCount: number): boolean {
  return optionCount > SEARCH_ABOVE;
}

/** Options whose label contains the typed text, case and diacritics ignored. */
export function matchOptions(options: FilterChoice[], query: string): FilterChoice[] {
  const q = foldText(query.trim());
  return q ? options.filter((o) => foldText(o.label).includes(q)) : options;
}

/** Sections with something chosen: the number on the "Filtre" button. */
export function activeSections(sections: ReadonlyArray<Pick<FilterSectionState, 'selected'>>): number {
  return sections.filter((s) => s.selected.length > 0).length;
}
