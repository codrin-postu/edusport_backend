import { refuse, type AdminResult } from '../admin-result';
import { isRecord } from '../narrow';
import { byGroupOrder, orderedSections, sectionLabel } from '../groups/sections';
import type { SeasonRecord } from '../groups/types';
import { PRESENCE_ERRORS } from '../presence/copy/core';
import type { PresenceStore } from '../presence/store';
import type { CatalogAnswer } from './catalog-api';
import { CATALOG, GROUP_LABELS } from './catalog';
import { TABLES_COPY } from './copy';
import { readDefinition, repairDefinition } from './definition';
import type { Budget } from './limit';
import { monthsIn, monthsInSeason, resolvePeriod, MAX_PERIOD_MONTHS } from './period';
import { MAX_ROWS, runQuery } from './query';
import { readyMadeFor } from './ready-made';
import { abonamenteRows } from './rows-abonamente';
import { platiRows } from './rows-plati';
import { prezentaRows } from './rows-prezenta';
import { sedinteTable } from './rows-sedinte';
import { sportiviRows } from './rows-sportivi';
import { loadSources } from './sources';
import type { TableDefinition, TableResult, TableRow } from './types';

export type TableFailure = { ok: false; status: 400 | 403 | 404 | 409 | 422 | 500 | 501; error: string };
type Opts = { today: string; budget: Budget; maxRows?: number };
const MAX_SEARCH = 200;

/** The `search` of a body: absent or blank is none; a non-text or over-long one is refused (null). */
function readSearch(body: unknown): string | null {
  const v = isRecord(body) ? body.search : undefined;
  if (v === undefined) return '';
  return typeof v === 'string' && v.length <= MAX_SEARCH ? v.trim() : null;
}

const invalid = refuse(400, PRESENCE_ERRORS.invalid);
/** Session states are not read by the table; the whole day counts as passed. */
const END_OF_DAY = '23:59';

/** Current season first: `repairDefinition` falls back to the first id. */
const currentFirst = (seasons: SeasonRecord[]): SeasonRecord[] => [...seasons].sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent));

/**
 * Months must belong to the season. A season that was swapped for the current one (the asked one is gone) takes its months with it: the
 * period resets with a notice. A request that names months outside an existing season is refused (null).
 */
function fitPeriod(d: TableDefinition, askedSeasonId: string, season: SeasonRecord, notices: string[]): TableDefinition | null {
  if (monthsInSeason(d.scope.period, { start: season.startMonth, end: season.endMonth })) return d;
  if (askedSeasonId === season.id) return null;
  if (!notices.includes(TABLES_COPY.notices.periodReset)) notices.push(TABLES_COPY.notices.periodReset);
  return { ...d, scope: { ...d.scope, period: null } };
}

/**
 * The definition a request names, checked against the catalog and then repaired against what exists now (a gone section, group or season
 * is ignored with a notice), so a download is exactly what the screen shows.
 */
async function prepare(store: PresenceStore, body: unknown): Promise<AdminResult<{ d: TableDefinition; notices: string[]; season: SeasonRecord; groupOrder: Map<string, number> }>> {
  const checked = readDefinition(body);
  if (!checked.ok) return invalid;
  const [seasons, sections, groups] = await Promise.all([store.seasons(), store.sections(), store.groups()]);
  const ordered = currentFirst(seasons);
  const repaired = repairDefinition(checked.value, { seasons: ordered.map((s) => s.id), sections: sections.map((s) => s.id), groups: groups.map((g) => g.id) });
  const d = repaired.definition;
  const season = d ? ordered.find((s) => s.id === d.scope.seasonId) : undefined;
  if (!d || !season) return invalid;
  const fitted = fitPeriod(d, checked.value.scope.seasonId, season, repaired.notices);
  if (fitted === null) return invalid;
  const groupOrder = new Map([...groups].sort(byGroupOrder).map((g, i) => [g.id, i] as const));
  return { ok: true, data: { d: fitted, notices: repaired.notices, season, groupOrder } };
}

function rowsOf(store: PresenceStore, d: TableDefinition, season: SeasonRecord, today: string): AdminResult<() => Promise<TableRow[]>> {
  const period = resolvePeriod(d.scope.period, { start: season.startMonth, end: season.endMonth }, today);
  if ((d.subject === 'plati' || d.subject === 'prezenta') && monthsIn(period) > MAX_PERIOD_MONTHS) return refuse(400, PRESENCE_ERRORS.periodTooLong);
  const build = async (): Promise<TableRow[]> => {
    const src = await loadSources(store, d, period);
    switch (d.subject) {
      case 'sportivi': return sportiviRows(src, d, period, today);
      case 'abonamente': return abonamenteRows(src, d, period, today);
      case 'plati': return platiRows(src, d, period);
      default: return prezentaRows(src, d, period);
    }
  };
  return { ok: true, data: build };
}

/** One table, for the screen or a file. A spent `budget` throws `BudgetError` (the controller answers 503). */
export async function runTable(store: PresenceStore, body: unknown, opts: Opts): Promise<AdminResult<TableResult>> {
  const search = readSearch(body);
  if (search === null) return invalid;
  const prepared = await prepare(store, body);
  if (prepared.ok === false) return prepared;
  const { d, notices, season, groupOrder } = prepared.data;
  if (d.subject === 'sedinte') {
    const made = await sedinteTable(store, d, opts.today, { date: opts.today, time: END_OF_DAY });
    if (made.ok === false) return made;
    const generated = { ...d, columns: made.data.columns.map((c) => c.key) };
    return runQuery(async () => made.data.rows, generated, made.data.columns, opts.budget, { notices, today: opts.today, groupOrder, maxRows: opts.maxRows, search });
  }
  const build = rowsOf(store, d, season, opts.today);
  if (build.ok === false) return build;
  const columns = d.columns.map((k) => CATALOG[d.subject].columns.find((c) => c.key === k)).filter((c): c is NonNullable<typeof c> => c !== undefined);
  return runQuery(build.data, d, columns, opts.budget, { notices, today: opts.today, groupOrder, maxRows: opts.maxRows, search });
}

export type ExportRequest = { definition: unknown; format: 'xlsx' | 'csv'; name?: string; search?: string };
const MAX_NAME = 80;

/** `{ definition, format }`, an optional name search and an optional view `name` (1 to 80 characters, trimmed), nothing else. */
export function readExportRequest(body: unknown): AdminResult<ExportRequest> {
  if (!isRecord(body)) return invalid;
  const keys = Object.keys(body);
  if (keys.some((k) => k !== 'definition' && k !== 'format' && k !== 'name' && k !== 'search') || (body.format !== 'xlsx' && body.format !== 'csv') || !readDefinition(body).ok) return invalid;
  const search = readSearch(body);
  if (search === null) return invalid;
  const base: ExportRequest = { definition: body.definition, format: body.format, ...(search === '' ? {} : { search }) };
  if (!('name' in body)) return { ok: true, data: base };
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length < 1 || name.length > MAX_NAME) return invalid;
  return { ok: true, data: { ...base, name } };
}

/** The team members who coach a group, by name. */
function coachesOf(groups: { coachIds?: string[] }[], team: { id: string; name: string }[]): { id: string; name: string }[] {
  const ids = new Set(groups.flatMap((g) => g.coachIds ?? []));
  return team.filter((t) => ids.has(t.id)).map((t) => ({ id: t.id, name: t.name })).sort((a, b) => a.name.localeCompare(b.name, 'ro'));
}

/** What the builder offers: the catalog, the scope choices and the ready-made views for the current season. */
export async function readCatalog(store: PresenceStore, today: string): Promise<CatalogAnswer> {
  const [seasons, sections, groups, team] = await Promise.all([store.seasons(), store.sections(), store.groups(), store.teamMembers()]);
  const ordered = currentFirst(seasons);
  return {
    subjects: CATALOG, groupLabels: GROUP_LABELS,
    seasons: ordered.map((s) => ({ id: s.id, label: s.label, startMonth: s.startMonth, endMonth: s.endMonth, isCurrent: s.isCurrent })),
    sections: orderedSections(sections).map((s) => ({ id: s.id, name: sectionLabel(s, sections) })),
    coaches: coachesOf(groups, team),
    groups: [...groups].sort(byGroupOrder).map((g) => ({ id: g.id, name: g.name, sectionId: g.sectionId, active: g.active })),
    readyMade: readyMadeFor(ordered[0]?.id ?? ''), defaultViewId: 'rm-plati-grupa', today, maxRows: MAX_ROWS,
  };
}
