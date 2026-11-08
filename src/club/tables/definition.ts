import { isIsoDate } from '../groups/dates';
import { PRESENCE_ERRORS } from '../presence/copy/core';
import type { Checked } from '../presence/payments/rules';
import { CATALOG } from './catalog';
import type { CatalogSubject } from './catalog';
import { TABLES_COPY } from './copy';
import { isPeriodSpec } from './period';
import type { CatalogColumn, FilterOp, GroupKey, PeriodSpec, Subject, TableDefinition, TableFilter } from './types';

export const MAX_COLUMNS = 20;
export const MAX_FILTERS = 10;
const MAX_BYTES = 16 * 1024;
const MAX_TEXT = 200;
const MAX_LIST = 50;
const MAX_ID = 100;
const MAX_RELATIVE_DAYS = 3660;

const SUBJECTS = Object.keys(CATALOG) as Subject[];
const GROUP_KEYS: GroupKey[] = ['grupa', 'sectiune', 'luna', 'antrenor'];
const OPS_BY_TYPE: Record<CatalogColumn['type'], FilterOp[]> = {
  text: ['eq', 'in', 'empty', 'notEmpty'], label: ['eq', 'in', 'empty', 'notEmpty'],
  number: ['eq', 'gt', 'lt', 'empty', 'notEmpty'], money: ['eq', 'gt', 'lt', 'empty', 'notEmpty'], date: ['eq', 'gt', 'lt', 'empty', 'notEmpty'],
};

const invalid = { ok: false, status: 400, error: PRESENCE_ERRORS.invalid } as const;
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const hasExactly = (o: Record<string, unknown>, keys: string[]): boolean => {
  const own = Object.keys(o);
  return own.length === keys.length && keys.every((k) => Object.prototype.hasOwnProperty.call(o, k));
};
const isId = (v: unknown): v is string => typeof v === 'string' && v !== '' && v.length <= MAX_ID;
const isNullableId = (v: unknown): v is string | null => v === null || isId(v);

export const subjectOf = (v: unknown): Subject | null => (typeof v === 'string' && SUBJECTS.includes(v as Subject) ? (v as Subject) : null);
export const columnOf = (catalog: Record<Subject, CatalogSubject>, subject: Subject, key: unknown): CatalogColumn | null =>
  catalog[subject].columns.find((c) => c.key === key) ?? null;

const isRelativeDate = (v: string): boolean => /^\+\d{1,4}d$/.test(v) && Number(v.slice(1, -1)) <= MAX_RELATIVE_DAYS;
const isText = (v: unknown): v is string => typeof v === 'string' && v.length <= MAX_TEXT;

function scalarOk(c: CatalogColumn, v: unknown): v is string | number {
  switch (c.type) {
    case 'number': case 'money': return typeof v === 'number' && Number.isFinite(v);
    case 'date': return typeof v === 'string' && (isIsoDate(v) || isRelativeDate(v));
    case 'label': return isText(v) && (c.values === undefined || c.values.includes(v));
    default: return isText(v);
  }
}

/** The one place a filter is checked: column of the subject, op of the column type, value of the column type. */
export function checkFilter(catalog: Record<Subject, CatalogSubject>, subject: Subject, f: unknown): TableFilter | null {
  if (!isObject(f)) return null;
  const c = columnOf(catalog, subject, f.column);
  const op = f.op as FilterOp;
  if (!c || typeof f.op !== 'string' || !OPS_BY_TYPE[c.type].includes(op)) return null;
  if (op === 'empty' || op === 'notEmpty') return hasExactly(f, ['column', 'op']) ? { column: c.key, op } : null;
  if (!hasExactly(f, ['column', 'op', 'value'])) return null;
  if (op !== 'in') return scalarOk(c, f.value) ? { column: c.key, op, value: f.value } : null;
  const list = f.value;
  const ok = Array.isArray(list) && list.length >= 1 && list.length <= MAX_LIST && list.every((x) => scalarOk(c, x));
  return ok ? { column: c.key, op, value: list as string[] } : null;
}

function checkScope(v: unknown): TableDefinition['scope'] | null {
  if (!isObject(v) || !hasExactly(v, ['seasonId', 'sectionId', 'groupId', 'period'])) return null;
  if (!isId(v.seasonId) || !isNullableId(v.sectionId) || !isNullableId(v.groupId) || !isPeriodSpec(v.period)) return null;
  return { seasonId: v.seasonId, sectionId: v.sectionId, groupId: v.groupId, period: v.period };
}

function checkColumns(catalog: Record<Subject, CatalogSubject>, subject: Subject, v: unknown): string[] | null {
  if (!Array.isArray(v) || v.length < 1 || v.length > MAX_COLUMNS) return null;
  const keys = v.map((k) => columnOf(catalog, subject, k)?.key ?? null);
  return keys.every((k): k is string => k !== null) && new Set(keys).size === keys.length ? keys : null;
}

function checkSort(v: unknown, columns: string[]): TableDefinition['sort'] | undefined {
  if (v === null) return null;
  if (!isObject(v) || !hasExactly(v, ['column', 'dir'])) return undefined;
  const ok = typeof v.column === 'string' && columns.includes(v.column) && (v.dir === 'asc' || v.dir === 'desc');
  return ok ? { column: v.column as string, dir: v.dir as 'asc' | 'desc' } : undefined;
}

function checkGroupBy(catalog: Record<Subject, CatalogSubject>, subject: Subject, v: unknown): GroupKey | null | undefined {
  if (v === null) return null;
  return typeof v === 'string' && GROUP_KEYS.includes(v as GroupKey) && catalog[subject].groupBy.includes(v as GroupKey) ? (v as GroupKey) : undefined;
}

function checkFilters(catalog: Record<Subject, CatalogSubject>, subject: Subject, v: unknown): TableFilter[] | null {
  if (!Array.isArray(v) || v.length > MAX_FILTERS) return null;
  const out = v.map((f) => checkFilter(catalog, subject, f));
  return out.every((f): f is TableFilter => f !== null) ? out : null;
}

function build(catalog: Record<Subject, CatalogSubject>, d: Record<string, unknown>): TableDefinition | null {
  const subject = subjectOf(d.subject);
  if (!subject || !hasExactly(d, ['subject', 'scope', 'columns', 'filters', 'groupBy', 'sort'])) return null;
  const scope = checkScope(d.scope);
  const columns = checkColumns(catalog, subject, d.columns);
  const filters = checkFilters(catalog, subject, d.filters);
  const groupBy = checkGroupBy(catalog, subject, d.groupBy);
  const sort = columns ? checkSort(d.sort, columns) : undefined;
  if (!scope || !columns || !filters || groupBy === undefined || sort === undefined) return null;
  return { subject, scope, columns, filters, groupBy, sort };
}

const tooBig = (v: unknown): boolean => JSON.stringify(v).length > MAX_BYTES;

/** `{ definition }` of a request body, or null (never throws on hostile input). The size is checked first, then the shape and every key against the catalog. */
export function readDefinition(body: unknown, catalog: Record<Subject, CatalogSubject> = CATALOG): Checked<TableDefinition> {
  if (!isObject(body) || !isObject(body.definition) || tooBig(body.definition)) return invalid;
  const value = build(catalog, body.definition);
  return value ? { ok: true, value } : invalid;
}

export type KnownIds = { seasons: string[]; sections: string[]; groups: string[] };
type Repair = { definition: TableDefinition | null; notices: string[] };

function repairFilters(subject: Subject, v: unknown): TableFilter[] {
  const list = Array.isArray(v) ? v.slice(0, MAX_FILTERS) : [];
  return list.map((f) => checkFilter(CATALOG, subject, f)).filter((f): f is TableFilter => f !== null);
}

/** The id when it is still there; else null, with a notice when the view had one. */
function keepId(id: unknown, ids: string[], notice: string, notices: string[]): string | null {
  if (typeof id === 'string' && ids.includes(id)) return id;
  if (id !== null && id !== undefined) notices.push(notice);
  return null;
}

function repairScope(v: unknown, known: KnownIds, notices: string[]): TableDefinition['scope'] | null {
  const s = isObject(v) ? v : {};
  const current = known.seasons[0];
  if (current === undefined) return null;
  const seasonId = keepId(s.seasonId, known.seasons, TABLES_COPY.notices.seasonMissing, notices) ?? current;
  const sectionId = keepId(s.sectionId, known.sections, TABLES_COPY.notices.sectionMissing, notices);
  const groupId = keepId(s.groupId, known.groups, TABLES_COPY.notices.groupMissing, notices);
  if (!isPeriodSpec(s.period)) notices.push(TABLES_COPY.notices.periodReset);
  return { seasonId, sectionId, groupId, period: isPeriodSpec(s.period) ? s.period : null };
}

/** A saved view opened later: unknown columns and filters on them go, a gone section or group is ignored, a gone season becomes the current one (first of `known.seasons`). One notice per kind of change; null only when nothing usable is left. */
export function repairDefinition(d: unknown, known: KnownIds): Repair {
  const subject = isObject(d) ? subjectOf(d.subject) : null;
  if (!isObject(d) || !subject) return { definition: null, notices: [] };
  const notices: string[] = [];
  const raw = Array.isArray(d.columns) ? d.columns : [];
  const columns = [...new Set(raw.map((k) => columnOf(CATALOG, subject, k)?.key).filter((k): k is string => !!k))].slice(0, MAX_COLUMNS);
  if (columns.length < raw.length) notices.push(TABLES_COPY.notices.columnDropped);
  const scope = repairScope(d.scope, known, notices);
  if (columns.length === 0 || !scope) return { definition: null, notices };
  const filters = repairFilters(subject, d.filters);
  if (filters.length < (Array.isArray(d.filters) ? d.filters.length : 0)) notices.push(TABLES_COPY.notices.filterDropped);
  const groupBy = checkGroupBy(CATALOG, subject, d.groupBy) ?? null;
  if (groupBy !== (d.groupBy ?? null)) notices.push(TABLES_COPY.notices.groupByDropped);
  const sort = checkSort(d.sort, columns) ?? null;
  if (sort === null && d.sort != null && !notices.includes(TABLES_COPY.notices.columnDropped)) notices.push(TABLES_COPY.notices.columnDropped);
  const definition: TableDefinition = { subject, scope, columns, filters, groupBy, sort };
  return { definition, notices };
}
