import { refuse, type AdminResult } from './admin-result';
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
  record(entry: HistoryInput): Promise<void>;
}

/** Every season, newest first, each with how many registrations point at it. */
export async function listAdminSeasons(store: SeasonStore): Promise<AdminSeason[]> {
  const rows = await store.all();
  const seasons = await Promise.all(
    rows.map(async (raw) => toAdminSeason(raw, typeof raw.documentId === 'string' ? await store.registrations(raw.documentId, String(raw.label)) : 0)),
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

async function updateRefusal(store: SeasonStore, stored: RawAdminSeason, documentId: string, fields: SeasonFields): Promise<AdminResult<never> | null> {
  const before = toSeasonFields(stored);
  if (before.label === fields.label) return null;
  if ((await store.registrations(documentId, before.label)) > 0) return refuse(409, SEASON_ERRORS.locked);
  return (await store.labelTaken(fields.label, documentId)) ? refuse(409, seasonExistsError(fields.label)) : null;
}

/** Edits label, period and fee. The label is locked once registrations point at the season. */
export async function updateSeason(store: SeasonStore, documentId: string, fields: SeasonFields, actor: string): Promise<AdminResult<AdminSeason[]>> {
  const stored = await store.find(documentId);
  if (!stored) return refuse(404, SEASON_ERRORS.missing);
  const refusal = await updateRefusal(store, stored, documentId, fields);
  if (refusal) return refusal;
  const changes = seasonChanges(toSeasonFields(stored), fields);
  if (Object.keys(changes).length === 0) return { ok: true, data: await listAdminSeasons(store) };
  await store.update(documentId, seasonWriteData(fields, stored));
  await store.record({ subjectType: 'season', subjectId: documentId, action: 'updated', changes, actor });
  return { ok: true, data: await listAdminSeasons(store) };
}
