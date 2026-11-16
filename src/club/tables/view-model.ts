import { addMonths, monthOf, monthTitle } from '../presence/dates';
import { monthsOfPeriod } from './period';
import { countWords } from '../ro-count';
import type { CatalogAnswer, SeasonChoice } from './catalog-api';
import { CATALOG, FILTERABLE, GROUP_COLUMN, GROUP_LABELS } from './catalog';
import { filterSummary } from './builder-state';
import { TABLES_COPY, TABLES_COUNT_WORDS } from './copy';
import type { CatalogColumn, GroupKey, Subject, TableDefinition, TableFilter } from './types';

/** Pure rules of the Tabele bar: which filters a type offers, its groupings, the one period list. The screen only wires them to controls. */

const columnOf = (subject: Subject, key: string): CatalogColumn | undefined =>
  CATALOG[subject].columns.find((c) => c.key === key) ?? (key === GROUP_COLUMN.key ? GROUP_COLUMN : undefined);

/** The filter columns of a type not yet used, in catalog order. */
export function filterFields(subject: Subject, used: TableFilter[]): CatalogColumn[] {
  const taken = new Set(used.map((f) => f.column));
  const own = CATALOG[subject].columns.filter((c) => FILTERABLE[subject].includes(c.key));
  const fields = FILTERABLE[subject].includes(GROUP_COLUMN.key) && !own.some((c) => c.key === GROUP_COLUMN.key) ? [...own, GROUP_COLUMN] : own;
  return fields.filter((c) => !taken.has(c.key));
}

/** The values of a filter field as chips offer them: its word list, or the names of the groups, sections and coaches. */
export function valuesOf(c: CatalogColumn, catalog: Pick<CatalogAnswer, 'groups' | 'sections' | 'coaches'>): string[] {
  if (c.key === 'grupa') return catalog.groups.filter((g) => g.active).map((g) => g.name);
  if (c.key === 'sectiune') return catalog.sections.map((x) => x.name);
  if (c.key === 'antrenor') return catalog.coaches.map((x) => x.name);
  return c.values ?? [];
}

/** The values a filter holds: the list of an "is one of", the one value of an "equals"; none for the other operators. */
export const filterValues = (f: TableFilter): string[] => (Array.isArray(f.value) ? f.value.map(String) : f.op === 'eq' && f.value !== undefined ? [String(f.value)] : []);

/**
 * Sets the values of a filter on a field as one "is one of" filter: replaces the filter at `index`, or appends when there is none yet.
 * No value left removes it (unticking the last value removes the chip).
 */
export function setFilterValues(d: TableDefinition, f: Pick<TableFilter, 'column'>, values: string[], index?: number): TableDefinition {
  const next: TableFilter | null = values.length === 0 ? null : { column: f.column, op: 'in', value: values };
  if (index === undefined) return next ? { ...d, filters: [...d.filters, next] } : d;
  return { ...d, filters: d.filters.flatMap((x, i) => (i !== index ? [x] : next ? [next] : [])) };
}

/** "Negrupat" first, then "Pe <coloană>" per grouping of the type; none for a type that has no grouping. */
export function groupingOptions(subject: Subject): { value: GroupKey | null; label: string }[] {
  const keys = CATALOG[subject].groupBy;
  if (keys.length === 0) return [];
  return [{ value: null, label: TABLES_COPY.ungrouped }, ...keys.map((k) => ({ value: k as GroupKey | null, label: `Pe ${GROUP_LABELS[k].toLocaleLowerCase('ro')}` }))];
}

export function removeFilter(d: TableDefinition, index: number): TableDefinition {
  return { ...d, filters: d.filters.filter((_, i) => i !== index) };
}

/** "Grupă: Avansați"; "Doar cu rest de plată" for the Restanțe filter. */
export function chipLabel(c: CatalogColumn, f: TableFilter): string {
  return c.key === 'ramas' && f.op === 'gt' && f.value === 0 ? TABLES_COPY.onlyOwing : filterSummary(c, f);
}

/** The label of a filter of a definition, by the catalog of its type. */
export function filterChipLabel(subject: Subject, f: TableFilter): string {
  const c = columnOf(subject, f.column);
  return c ? chipLabel(c, f) : f.column;
}

/** Months of a season, first to last (a season is under two years, so the loop is short). */
export function seasonMonths(season: Pick<SeasonChoice, 'startMonth' | 'endMonth'>): string[] {
  const out: string[] = [];
  for (let m = monthOf(season.startMonth); m <= monthOf(season.endMonth) && out.length < 36; m = addMonths(m, 1)) out.push(m);
  return out;
}

const SHORT_MONTHS = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
export const shortMonth = (month: string): string => SHORT_MONTHS[Number(month.slice(5, 7)) - 1];

/** The months a definition names, oldest first; none for the whole season. */
export const periodMonths = (d: TableDefinition, today: string): string[] => monthsOfPeriod(d.scope.period, today);

const withMonths = (d: TableDefinition, months: string[]): TableDefinition => ({
  ...d, scope: { ...d.scope, period: months.length === 0 ? null : { kind: 'months', months: [...new Set(months)].sort() } },
});

/** The button of the period picker: the season alone, one month ("Noiembrie 2026"), or several ("2026-2027: Oct, Nov"). */
export function periodLabel(seasonLabel: string, months: string[]): string {
  if (months.length === 0) return seasonLabel;
  if (months.length === 1) return monthTitle(months[0]);
  return `${seasonLabel}: ${months.map(shortMonth).join(', ')}`;
}

/** A month ticked or unticked; Prezență pe ședințe holds exactly one, so a month replaces the one before (and cannot be unticked). */
export function toggleMonth(d: TableDefinition, month: string, today: string): TableDefinition {
  const now = periodMonths(d, today);
  if (d.subject === 'sedinte') return withMonths(d, [month]);
  return withMonths(d, now.includes(month) ? now.filter((m) => m !== month) : [...now, month]);
}

/** "Tot sezonul": no month. */
export const clearMonths = (d: TableDefinition): TableDefinition => withMonths(d, []);

/** Another season; each chosen month moves to the same calendar month of it (September 2026 to September 2025), the ones it lacks go. */
export function setSeason(d: TableDefinition, season: SeasonChoice, today: string): TableDefinition {
  const own = seasonMonths(season);
  const moved = periodMonths(d, today).flatMap((m) => own.filter((x) => x.slice(5) === m.slice(5)));
  return withMonths({ ...d, scope: { ...d.scope, seasonId: season.id } }, moved);
}

/** "1 plată", "12 plăți". */
export function countLine(subject: Subject, n: number): string {
  const [one, many] = TABLES_COUNT_WORDS[subject];
  return countWords(n, one, many);
}
