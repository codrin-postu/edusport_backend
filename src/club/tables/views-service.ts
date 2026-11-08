import { guarded, refuse, type AdminResult } from '../admin-result';
import { done, type ActionResult } from '../groups/action-log';
import { isRecord } from '../narrow';
import { PRESENCE_ERRORS } from '../presence/copy/core';
import { SUBJECT } from '../subjects';
import { TABLES_COPY } from './copy';
import { readDefinition, repairDefinition, type KnownIds } from './definition';
import type { SavedViewRow, TableDefinition } from './types';
import type { TableViewStore, ViewRow } from './views-store';
import { VIEW_UNDO_KIND, readViewUndo } from './views-undo';

/** The admin behind a request. `email` is the Istoric actor; `superAdmin` comes from the database roles, never from a claim. */
export type Caller = { adminId: number; name: string; email: string; superAdmin: boolean };
type Opts = { now?: () => Date; log?: (message: string) => void };

export const MAX_VIEWS = 200;
export const MAX_NAME = 80;
const PURGE_AFTER_MS = 24 * 60 * 60 * 1000;
export const VIEW_DELETED_ACTION = 'table-view-deleted';

const V = TABLES_COPY.views;
const invalid = refuse(400, PRESENCE_ERRORS.invalid);
const notFound = refuse(404, PRESENCE_ERRORS.notFound);
const notAuthor = refuse(403, V.notAuthor);
const duplicate = (status: 400 | 409) => refuse(status, V.duplicate);
const logOf = (o: Opts) => o.log ?? ((m: string) => console.error(m));
const nowOf = (o: Opts): Date => (o.now ?? (() => new Date()))();

const sameName = (a: string, b: string): boolean => a.trim().toLocaleLowerCase('ro') === b.trim().toLocaleLowerCase('ro');
const readName = (v: unknown): string | null => (typeof v === 'string' && v.trim().length >= 1 && v.trim().length <= MAX_NAME ? v.trim() : null);

/** Ids a stored definition names, so a repair on load keeps them (the screen checks them against the live data). */
function ownIds(raw: unknown): KnownIds {
  const scope = isRecord(raw) && isRecord(raw.scope) ? raw.scope : {};
  const one = (v: unknown): string[] => (typeof v === 'string' && v ? [v] : []);
  return { seasons: one(scope.seasonId), sections: one(scope.sectionId), groups: one(scope.groupId) };
}

/**
 * A stored row for the screen. The definition is checked again here, on every load: valid as it is, or repaired against the catalog with notices,
 * or, when nothing usable is left, the view is still listed as `broken` (no definition, cannot be opened) so its author can delete it.
 */
function toSavedRow(row: ViewRow, caller: Caller): SavedViewRow {
  const checked = readDefinition({ definition: row.definition });
  let definition: TableDefinition | null = null;
  let notices: string[] | undefined;
  if (checked.ok) definition = checked.value;
  else {
    const repaired = repairDefinition(row.definition, ownIds(row.definition));
    const again = repaired.definition ? readDefinition({ definition: repaired.definition }) : null;
    if (again && again.ok) {
      definition = again.value;
      notices = repaired.notices;
    }
  }
  const mine = row.authorId === caller.adminId;
  return {
    id: row.id, name: row.name, subject: definition?.subject ?? row.subject, definition, authorId: String(row.authorId), authorName: row.authorName,
    mine, canDelete: mine || caller.superAdmin, readyMade: false,
    ...(definition === null ? { broken: true as const } : {}), ...(notices && notices.length > 0 ? { notices } : {}),
  };
}

export async function listViews(store: TableViewStore, caller: Caller): Promise<SavedViewRow[]> {
  // The store lists oldest first (id ascending); the contract says newest first.
  return (await store.views()).map((r) => toSavedRow(r, caller)).reverse();
}

type Body = { name?: string; definition?: TableDefinition };

/** Exactly the allowed keys, each valid; `needed` keys must be there. The author, id and dates are never read from a body. */
function readBody(body: unknown, needed: ('name' | 'definition')[]): Body | null {
  if (!isRecord(body)) return null;
  const keys = Object.keys(body);
  if (keys.some((k) => k !== 'name' && k !== 'definition') || keys.length === 0 || !needed.every((k) => k in body)) return null;
  const out: Body = {};
  if ('name' in body) {
    const name = readName(body.name);
    if (name === null) return null;
    out.name = name;
  }
  if ('definition' in body) {
    const checked = readDefinition({ definition: body.definition });
    if (!checked.ok) return null;
    out.definition = checked.value;
  }
  return out;
}

type SavedAction = ActionResult<{ view: SavedViewRow; toast: string }>;

function saved(row: ViewRow, caller: Caller, toast: string): AdminResult<{ value: { view: SavedViewRow; toast: string }; actionId: null }> {
  return done({ view: toSavedRow(row, caller), toast }, null) as AdminResult<{ value: { view: SavedViewRow; toast: string }; actionId: null }>;
}

export async function createView(store: TableViewStore, caller: Caller, body: unknown, opts: Opts = {}): Promise<SavedAction> {
  const read = readBody(body, ['name', 'definition']);
  if (!read || read.name === undefined || read.definition === undefined) return invalid;
  const { name, definition } = { name: read.name, definition: read.definition };
  return guarded(logOf(opts), '[table-view] create', () => store.transaction(async (): Promise<SavedAction> => {
    await store.lockViewNames();
    const live = await store.views();
    if (live.some((v) => sameName(v.name, name))) return duplicate(400);
    if (live.length >= MAX_VIEWS) return refuse(400, V.tooMany);
    const row: ViewRow = { id: '', name, subject: definition.subject, definition, authorId: caller.adminId, authorName: caller.name, deletedAt: null };
    row.id = await store.createView({ name, subject: definition.subject, definition, authorId: caller.adminId, authorName: caller.name });
    return saved(row, caller, V.saved);
  }));
}

/** Only the author edits a view; a Super Admin may delete someone else's, not change it. */
export async function updateView(store: TableViewStore, caller: Caller, id: string, body: unknown, opts: Opts = {}): Promise<SavedAction> {
  const patch = readBody(body, []);
  if (!patch) return invalid;
  return guarded(logOf(opts), `[table-view] update ${id}`, () => store.transaction(async (): Promise<SavedAction> => {
    await store.lockViewNames();
    await store.lockView(id);
    const row = await store.view(id);
    if (!row || row.deletedAt !== null) return notFound;
    if (row.authorId !== caller.adminId) return notAuthor;
    if (patch.name !== undefined && (await store.views()).some((v) => v.id !== id && sameName(v.name, patch.name as string))) return duplicate(400);
    await store.updateView(id, {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.definition !== undefined ? { definition: patch.definition, subject: patch.definition.subject } : {}),
    });
    const fresh = await store.view(id);
    if (!fresh) throw new Error('the view vanished inside its own transaction');
    return saved(fresh, caller, V.updated);
  }));
}

/** The author or a Super Admin. Soft delete, one Istoric line with the undo record (no definition, no athlete), and a purge of views deleted over a day ago. */
export async function deleteView(store: TableViewStore, caller: Caller, id: string, opts: Opts = {}): Promise<ActionResult<{ deleted: true; toast: string }>> {
  return guarded(logOf(opts), `[table-view] delete ${id}`, () => store.transaction(async (): Promise<ActionResult<{ deleted: true; toast: string }>> => {
    await store.lockView(id);
    const row = await store.view(id);
    if (!row || row.deletedAt !== null) return notFound;
    if (row.authorId !== caller.adminId && !caller.superAdmin) return notAuthor;
    const now = nowOf(opts);
    await store.setDeleted(id, now.toISOString());
    const actionId = await store.recordAction(caller.email, {
      subjectType: SUBJECT.tableView, subjectId: id, action: VIEW_DELETED_ACTION, changes: { byAdminId: caller.adminId, undo: { kind: VIEW_UNDO_KIND, id } },
    });
    await store.purgeDeletedBefore(new Date(now.getTime() - PURGE_AFTER_MS).toISOString());
    return done({ deleted: true as const, toast: V.deleted }, actionId);
  }));
}

/**
 * The toast's "Anulează" of a view delete. Only the admin who deleted it, and only while he is still entitled to (the author, or a Super Admin).
 * Refused when the entry was undone, the view is live or gone, or a live view took the name meanwhile.
 */
export async function undoViewDelete(store: TableViewStore, caller: Caller, actionId: string, opts: Opts = {}): Promise<AdminResult<{ undone: true }>> {
  return guarded(logOf(opts), `[table-view] undo ${actionId}`, () => store.transaction(async (): Promise<AdminResult<{ undone: true }>> => {
    const first = await store.historyEntry(actionId);
    if (!first) return notFound;
    const record = readViewUndo(first.changes.undo);
    if (!record) return refuse(409, PRESENCE_ERRORS.undoChanged);
    await store.lockViewNames();
    await store.lockView(record.id);
    const entry = await store.historyEntry(actionId);
    if (!entry || entry.changes.undone === true) return refuse(409, PRESENCE_ERRORS.undoChanged);
    const view = await store.view(record.id);
    if (!view || view.deletedAt === null) return refuse(409, PRESENCE_ERRORS.undoChanged);
    const deleter = entry.changes.byAdminId === caller.adminId;
    if (!deleter || (view.authorId !== caller.adminId && !caller.superAdmin)) return notAuthor;
    if ((await store.views()).some((v) => sameName(v.name, view.name))) return duplicate(409);
    await store.setDeleted(record.id, null);
    await store.setHistoryChanges(actionId, { ...entry.changes, undone: true });
    return { ok: true, data: { undone: true } };
  }));
}
