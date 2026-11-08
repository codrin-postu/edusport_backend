import { refuse, type AdminResult } from '../admin-result';
import { isRecord } from '../narrow';
import { byGroupOrder, orderedSections, sectionLabel } from '../groups/sections';
import type { SeasonRecord } from '../groups/types';
import { PRESENCE_ERRORS } from '../presence/copy/core';
import type { PresenceStore } from '../presence/store';
import { CATALOG, GROUP_LABELS, type CatalogSubject } from './catalog';
import { TABLES_COPY } from './copy';
import { readDefinition, repairDefinition } from './definition';
import type { Budget } from './limit';
import { monthsIn, resolvePeriod, MAX_PERIOD_MONTHS } from './period';
import { MAX_ROWS, runQuery } from './query';
import { readyMadeFor } from './ready-made';
import { abonamenteRows } from './rows-abonamente';
import { platiRows } from './rows-plati';
import { prezentaRows } from './rows-prezenta';
import { sportiviRows } from './rows-sportivi';
import { loadSources } from './sources';
import type { SavedViewRow, Subject, TableDefinition, TableResult, TableRow } from './types';

/** Until the xlsx writer lands (Task 2) a .xlsx download answers 501 with this text. COPY NEEDED: the user gives the copy. */
export const TABLES_NO_XLSX = TABLES_COPY.errors.xlsxUnavailable;
/** Flip to true when `tableXlsx` writes real files (Task 2); the controller then sends the file instead of 501. */
export const XLSX_READY = false;

export type TableFailure = { ok: false; status: 400 | 403 | 404 | 409 | 422 | 500 | 501; error: string };
type Opts = { today: string; budget: Budget; maxRows?: number };

const invalid = refuse(400, PRESENCE_ERRORS.invalid);

/** Current season first: `repairDefinition` falls back to the first id. */
const currentFirst = (seasons: SeasonRecord[]): SeasonRecord[] => [...seasons].sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent));

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
  const groupOrder = new Map([...groups].sort(byGroupOrder).map((g, i) => [g.id, i] as const));
  return { ok: true, data: { d, notices: repaired.notices, season, groupOrder } };
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
  const prepared = await prepare(store, body);
  if (prepared.ok === false) return prepared;
  const { d, notices, season, groupOrder } = prepared.data;
  const build = rowsOf(store, d, season, opts.today);
  if (build.ok === false) return build;
  const columns = d.columns.map((k) => CATALOG[d.subject].columns.find((c) => c.key === k)).filter((c): c is NonNullable<typeof c> => c !== undefined);
  return runQuery(build.data, d, columns, opts.budget, { notices, today: opts.today, groupOrder, maxRows: opts.maxRows });
}

export type ExportRequest = { definition: unknown; format: 'xlsx' | 'csv' };

/** `{ definition, format }` and nothing else. */
export function readExportRequest(body: unknown): AdminResult<ExportRequest> {
  if (!isRecord(body)) return invalid;
  const keys = Object.keys(body);
  if (keys.some((k) => k !== 'definition' && k !== 'format') || (body.format !== 'xlsx' && body.format !== 'csv') || !readDefinition(body).ok) return invalid;
  return { ok: true, data: { definition: body.definition, format: body.format } };
}

export type CatalogAnswer = {
  subjects: Record<Subject, CatalogSubject>;
  groupLabels: typeof GROUP_LABELS;
  seasons: { id: string; label: string; startMonth: string; endMonth: string; isCurrent: boolean }[];
  sections: { id: string; name: string }[];
  groups: { id: string; name: string; sectionId: string | null; active: boolean }[];
  readyMade: SavedViewRow[];
  defaultViewId: string;
  today: string;
  maxRows: number;
};

/** What the builder offers: the catalog, the scope choices and the ready-made views for the current season. */
export async function readCatalog(store: PresenceStore, today: string): Promise<CatalogAnswer> {
  const [seasons, sections, groups] = await Promise.all([store.seasons(), store.sections(), store.groups()]);
  const ordered = currentFirst(seasons);
  return {
    subjects: CATALOG, groupLabels: GROUP_LABELS,
    seasons: ordered.map((s) => ({ id: s.id, label: s.label, startMonth: s.startMonth, endMonth: s.endMonth, isCurrent: s.isCurrent })),
    sections: orderedSections(sections).map((s) => ({ id: s.id, name: sectionLabel(s, sections) })),
    groups: [...groups].sort(byGroupOrder).map((g) => ({ id: g.id, name: g.name, sectionId: g.sectionId, active: g.active })),
    readyMade: readyMadeFor(ordered[0]?.id ?? ''), defaultViewId: 'rm-plati-grupa', today, maxRows: MAX_ROWS,
  };
}
