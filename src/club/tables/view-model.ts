import { addMonths, monthOf, monthTitle } from '../presence/dates';
import { countWords } from '../ro-count';
import type { SeasonChoice } from './catalog-api';
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

export type PeriodChoice = { value: string; label: string };

/** Months of a season, first to last (a season is under two years, so the loop is short). */
function monthsOf(season: SeasonChoice): string[] {
  const out: string[] = [];
  for (let m = monthOf(season.startMonth); m <= monthOf(season.endMonth) && out.length < 36; m = addMonths(m, 1)) out.push(m);
  return out;
}

const choiceValue = (seasonId: string, month: string | null): string => `${seasonId}|${month ?? ''}`;

/** Per season its months, then the whole season; only months (none after the current one) for Prezență pe ședințe. */
export function periodChoices(subject: Subject, cat: { seasons: SeasonChoice[]; today: string }): PeriodChoice[] {
  const sedinte = subject === 'sedinte';
  const now = monthOf(cat.today);
  return cat.seasons.flatMap((s) => {
    const months = monthsOf(s).filter((m) => !sedinte || m <= now).map((m): PeriodChoice => ({ value: choiceValue(s.id, m), label: monthTitle(m) }));
    return sedinte ? months : [...months, { value: choiceValue(s.id, null), label: TABLES_COPY.seasonOption(s.label) }];
  });
}

/** The choice value a definition's season and period stand for. */
export function periodValue(d: TableDefinition, today: string): string {
  const { period, seasonId } = d.scope;
  return choiceValue(seasonId, period === null ? null : period.kind === 'current' ? monthOf(today) : period.month);
}

/** Sets the season and the period together, so a month always belongs to the season shown with it. */
export function applyPeriodChoice(d: TableDefinition, value: string): TableDefinition {
  const [seasonId, month] = value.split('|');
  return { ...d, scope: { ...d.scope, seasonId, period: month ? { kind: 'month', month } : null } };
}

/** "1 plată", "12 plăți". */
export function countLine(subject: Subject, n: number): string {
  const [one, many] = TABLES_COUNT_WORDS[subject];
  return countWords(n, one, many);
}
