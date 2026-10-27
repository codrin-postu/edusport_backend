import { refuse, type AdminResult, type AdminResultWithMeta } from './admin-result';
import { ADMIN_ERRORS } from './athletes/errors';
import { planSeasonMove, usesSeason } from './groups/season-series';
import type { EventRecord, Recurrence } from './groups/types';
import type { HistoryInput } from './history';
import {
  SEASON_ERRORS,
  byNewest,
  seasonChanges,
  seasonExistsError,
  seasonWriteData,
  toAdminSeason,
  toSeasonFields,
  type AdminSeason,
  type RawAdminSeason,
  type SeasonFields,
  type SeasonWriteData,
} from './season-admin';

/** Storage the Sezoane actions need. `strapiSeasonStore` (season-admin-store.ts) is the real one; tests pass a fake. */
export interface SeasonStore {
  all(): Promise<RawAdminSeason[]>;
  find(documentId: string): Promise<RawAdminSeason | null>;
  labelTaken(label: string, exceptId: string | null): Promise<boolean>;
  /** Registrations pointing at the season (by relation or by the old season text). */
  registrations(documentId: string, label: string): Promise<number>;
  create(data: SeasonWriteData & { isCurrent: false }): Promise<string>;
  update(documentId: string, data: SeasonWriteData): Promise<void>;
  /** All writes inside `work` are saved together or not at all. */
  transaction<T>(work: () => Promise<T>): Promise<T>;
  /** Inside a transaction. Lock order: registrations, seasons, athletes, groups, events (events sorted by id). */
  lockSeason(documentId: string): Promise<void>;
  lockEvent(id: string): Promise<void>;
  /** Group membership rows of the season, ended ones included. */
  memberships(documentId: string): Promise<number>;
  /** Every calendar event that belongs to a group. */
  groupEvents(): Promise<EventRecord[]>;
  updateSeries(id: string, recurrence: Recurrence): Promise<void>;
  record(entry: HistoryInput): Promise<void>;
}

/** Every season, newest first, each with how many registrations point at it. */
export async function listAdminSeasons(store: SeasonStore): Promise<AdminSeason[]> {
  const [rows, events] = await Promise.all([store.all(), store.groupEvents()]);
  const seasons = await Promise.all(
    rows.map(async (raw) => {
      if (typeof raw.documentId !== 'string') return toAdminSeason(raw, 0);
      const inUse = (await store.memberships(raw.documentId)) > 0 || usesSeason(events, toSeasonDates(raw));
      return toAdminSeason(raw, await store.registrations(raw.documentId, String(raw.label)), inUse);
    }),
  );
  return seasons.filter((s): s is AdminSeason => s !== null).sort(byNewest);
}

/** "+ Sezon nou": always created as not current (making a season current is phase 4). */
export async function createSeason(store: SeasonStore, fields: SeasonFields, actor: string): Promise<AdminResult<AdminSeason[]>> {
  if (await store.labelTaken(fields.label, null)) return refuse(409, seasonExistsError(fields.label));
  const documentId = await store.create({ ...seasonWriteData(fields, null), isCurrent: false });
  await store.record({ subjectType: 'season', subjectId: documentId, action: 'created', changes: seasonChanges(null, fields), actor });
  return { ok: true, data: await listAdminSeasons(store) };
}

type SeasonDates = { startMonth: string; endMonth: string };
const toSeasonDates = (raw: RawAdminSeason): SeasonDates => ({ startMonth: String(raw.startMonth ?? ''), endMonth: String(raw.endMonth ?? '') });

/** The name is locked once registrations, group memberships or group classes use the season. */
async function updateRefusal(store: SeasonStore, stored: RawAdminSeason, documentId: string, fields: SeasonFields): Promise<AdminResult<never> | null> {
  const before = toSeasonFields(stored);
  if (before.label === fields.label) return null;
  if ((await store.registrations(documentId, before.label)) > 0) return refuse(409, SEASON_ERRORS.locked);
  const inUse = (await store.memberships(documentId)) > 0 || usesSeason(await store.groupEvents(), toSeasonDates(stored));
  if (inUse) return refuse(409, ADMIN_ERRORS.stale);
  return (await store.labelTaken(fields.label, documentId)) ? refuse(409, seasonExistsError(fields.label)) : null;
}

/** Group series that followed the old period take the new one (sorted locks on the events, after the season's). */
async function moveSeries(store: SeasonStore, old: SeasonDates, written: SeasonWriteData): Promise<Record<string, number>> {
  const plan = planSeasonMove(await store.groupEvents(), old, written);
  for (const move of [...plan.moves].sort((a, b) => a.eventId.localeCompare(b.eventId))) await store.lockEvent(move.eventId);
  for (const move of plan.moves) await store.updateSeries(move.eventId, move.recurrence);
  return { moved: plan.moves.length, outside: plan.outside };
}

const periodChanged = (old: SeasonDates, written: SeasonWriteData) =>
  old.startMonth.slice(0, 10) !== written.startMonth || old.endMonth.slice(0, 10) !== written.endMonth;

async function updateLocked(store: SeasonStore, documentId: string, fields: SeasonFields, actor: string): Promise<AdminResultWithMeta<AdminSeason[]>> {
  await store.lockSeason(documentId);
  const stored = await store.find(documentId);
  if (!stored) return refuse(404, SEASON_ERRORS.missing);
  const refusal = await updateRefusal(store, stored, documentId, fields);
  if (refusal) return refusal;
  const changes = seasonChanges(toSeasonFields(stored), fields);
  if (Object.keys(changes).length === 0) return { ok: true, data: await listAdminSeasons(store) };
  const written = seasonWriteData(fields, stored);
  const old = toSeasonDates(stored);
  await store.update(documentId, written);
  const meta = periodChanged(old, written) ? await moveSeries(store, old, written) : undefined;
  await store.record({ subjectType: 'season', subjectId: documentId, action: 'updated', changes, actor });
  return { ok: true, data: await listAdminSeasons(store), ...(meta ? { meta } : {}) };
}

/**
 * Edits label, period and fee in one transaction on the locked season. The label is locked once registrations, group
 * memberships or group classes use the season; a new period moves the group series of the season (meta: `moved` series,
 * `outside` single classes left where they were).
 */
export const updateSeason = (store: SeasonStore, documentId: string, fields: SeasonFields, actor: string): Promise<AdminResult<AdminSeason[]>> =>
  store.transaction(() => updateLocked(store, documentId, fields, actor));
