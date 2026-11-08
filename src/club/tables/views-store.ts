import type { Core } from '@strapi/strapi';
import { iso, text, transactionScope, type Raw } from '../athletes/strapi-store';
import { found, strapiGroupStore } from '../groups/strapi-store';
import type { HistoryEntryRow } from '../groups/types';
import type { Subject } from './types';

/** A saved view as stored. `definition` is whatever the database holds: it is never trusted (every load goes through the validator). */
export type ViewRow = { id: string; name: string; subject: Subject; definition: unknown; authorId: number; authorName: string; deletedAt: string | null };
export type NewView = Omit<ViewRow, 'id' | 'deletedAt'>;
export type ViewPatch = Partial<Pick<ViewRow, 'name' | 'subject' | 'definition'>>;
/** One Istoric line of a view action. */
export type ViewLine = { subjectType: string; subjectId: string; action: string; changes?: Record<string, unknown> };

/**
 * One store per request: the transaction scope lives in the store, so a store must never be shared between requests.
 * Lock order (binding): names first, then the view.
 */
export interface TableViewStore {
  /** All writes inside `work` are saved together or not at all; a nested call reuses the outer transaction. */
  transaction<T>(work: () => Promise<T>): Promise<T>;
  /** Inside a transaction, held until it ends. */
  lockView(id: string): Promise<void>;
  /** Serializes everything that checks names or the 200 limit (creates, renames, undo): a row lock cannot guard a row that does not exist yet. */
  lockViewNames(): Promise<void>;
  views(opts?: { includeDeleted?: boolean }): Promise<ViewRow[]>;
  view(id: string): Promise<ViewRow | null>;
  createView(row: NewView): Promise<string>;
  updateView(id: string, patch: ViewPatch): Promise<void>;
  setDeleted(id: string, at: string | null): Promise<void>;
  /** Hard delete of the views deleted before `iso`; answers how many. */
  purgeDeletedBefore(iso: string): Promise<number>;
  /** The group store's Istoric write; answers the action id the toast's "Anulează" sends. */
  recordAction(actor: string, line: ViewLine): Promise<string>;
  historyEntry(id: string): Promise<HistoryEntryRow | null>;
  setHistoryChanges(id: string, changes: Record<string, unknown>): Promise<void>;
}

const VIEW = 'api::table-view.table-view' as const;
const TABLE = 'club_table_views';
const MAX = 1000;

const subjectOf = (v: unknown): Subject => (v === 'sportivi' || v === 'abonamente' || v === 'prezenta' ? v : 'plati');
const toViewRow = (r: Raw): ViewRow => ({
  id: text(r.documentId), name: text(r.name), subject: subjectOf(r.subject), definition: r.definition ?? null,
  authorId: Number(r.authorId), authorName: text(r.authorName), deletedAt: iso(r.deletedAt),
});

/** TableViewStore on Strapi: document service for writes (validation, lifecycles), db queries for reads and the purge. */
export function strapiTableViewStore(strapi: Core.Strapi): TableViewStore {
  const scope = transactionScope(strapi);
  const history = strapiGroupStore(strapi);
  const docs = () => strapi.documents(VIEW);
  return {
    transaction: scope.transaction,
    lockView: (id) => scope.lockRow(TABLE, id),
    lockViewNames: async () => {
      const trx = scope.current();
      if (!trx) throw new Error(`lock on ${TABLE} taken outside a transaction`);
      // Postgres only (production); a dev SQLite database has one writer at a time anyway.
      if (strapi.db.dialect.client === 'postgres') await trx.raw('select pg_advisory_xact_lock(hashtext(?))', [TABLE]);
    },
    views: async (opts = {}) => {
      const rows = await strapi.db.query(VIEW).findMany({ where: opts.includeDeleted ? {} : { deletedAt: { $null: true } }, orderBy: { id: 'asc' }, limit: MAX });
      return (rows as Raw[]).map(toViewRow);
    },
    view: async (id) => {
      const row = await strapi.db.query(VIEW).findOne({ where: { documentId: id } });
      return row ? toViewRow(row as Raw) : null;
    },
    createView: async (row) => (await docs().create({ data: { ...row } as never })).documentId,
    updateView: async (id, patch) => {
      found(await docs().update({ documentId: id, data: patch as never }), 'updateView');
    },
    setDeleted: async (id, at) => {
      found(await docs().update({ documentId: id, data: { deletedAt: at } as never }), 'setDeleted');
    },
    purgeDeletedBefore: async (before) => (await strapi.db.query(VIEW).deleteMany({ where: { deletedAt: { $lt: before } } })).count,
    recordAction: async (actor, line) => (await history.recordAction({ ...line, actor })).id,
    historyEntry: (id) => history.historyEntry(id),
    setHistoryChanges: (id, changes) => history.setHistoryChanges(id, changes),
  };
}
