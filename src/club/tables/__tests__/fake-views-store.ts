import type { HistoryEntryRow } from '../../groups/types';
import type { TableViewStore, ViewRow } from '../views-store';

export type FakeViewsState = { views: ViewRow[]; history: HistoryEntryRow[]; locks: string[] };
export type FakeViewsDb = {
  state: FakeViewsState;
  /** A store for one request: its own transaction scope over the shared rows and locks. */
  store(): TableViewStore;
  failOn(method: keyof TableViewStore): void;
};

const NOON = Date.UTC(2026, 10, 20, 12, 0, 0);
const turn = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 0); });

export const viewRow = (over: Partial<ViewRow> & { id: string }): ViewRow => ({
  name: `Vizualizare ${over.id}`, subject: 'plati', definition: null, authorId: 1, authorName: 'Ana', deletedAt: null, ...over,
});

/**
 * In-memory rows shared by every store it hands out, like one database. Each store has its own transaction scope. Row locks are real
 * mutexes held to the end of the transaction, and every method yields, so two requests interleave and a missing lock shows as a lost race.
 * A failed transaction undoes its writes. `locking: false` turns the locks into no-ops (the proof that the race tests have teeth).
 */
export function fakeViewsDb(seed: { views?: ViewRow[]; history?: HistoryEntryRow[] } = {}, options: { locking?: boolean } = {}): FakeViewsDb {
  const state: FakeViewsState = structuredClone({ views: seed.views ?? [], history: seed.history ?? [], locks: [] });
  const failing = new Set<string>();
  const owners = new Map<string, symbol>();
  const waiters: (() => void)[] = [];
  let n = 0;
  const locking = options.locking !== false;

  async function acquire(key: string, txn: symbol): Promise<void> {
    if (!locking) return;
    while (owners.has(key) && owners.get(key) !== txn) await new Promise<void>((resolve) => { waiters.push(resolve); });
    owners.set(key, txn);
  }
  function release(txn: symbol): void {
    for (const [key, owner] of [...owners]) if (owner === txn) owners.delete(key);
    waiters.splice(0).forEach((wake) => wake());
  }

  function store(): TableViewStore {
    let txn: symbol | null = null;
    let journal: (() => void)[] = [];
    const guard = <A extends unknown[], R>(name: keyof TableViewStore, work: (...a: A) => R | Promise<R>) => async (...args: A): Promise<R> => {
      if (failing.has(name)) throw new Error(`fake failure in ${name}`);
      await turn();
      const out = await work(...args);
      await turn();
      return out;
    };
    const lock = (kind: string) => async (id: string): Promise<void> => {
      if (txn === null) throw new Error(`fake: lock on ${kind}:${id} outside a transaction`);
      await acquire(`${kind}:${id}`, txn);
      state.locks.push(`${kind}:${id}`);
    };
    const find = (id: string): ViewRow | undefined => state.views.find((v) => v.id === id);
    return {
      async transaction<T>(work: () => Promise<T>): Promise<T> {
        if (txn !== null) return work();
        const mine = Symbol('txn');
        txn = mine;
        journal = [];
        try {
          return await work();
        } catch (err) {
          for (const undo of journal.reverse()) undo();
          throw err;
        } finally {
          release(mine);
          txn = null;
        }
      },
      lockView: guard('lockView', lock('view')),
      lockViewNames: guard('lockViewNames', () => lock('names')('all')),
      views: guard('views', (opts?: { includeDeleted?: boolean }) => state.views.filter((v) => opts?.includeDeleted || v.deletedAt === null).map((v) => structuredClone(v))),
      view: guard('view', (id: string) => { const v = find(id); return v ? structuredClone(v) : null; }),
      createView: guard('createView', (row) => {
        const id = `v-${(n += 1)}`;
        state.views.push({ ...structuredClone(row), id, deletedAt: null });
        journal.push(() => { state.views = state.views.filter((v) => v.id !== id); });
        return id;
      }),
      updateView: guard('updateView', (id, patch) => {
        const v = find(id);
        if (!v) throw new Error('updateView: the row does not exist');
        const before = structuredClone(v);
        Object.assign(v, structuredClone(patch));
        journal.push(() => { Object.assign(v, before); });
      }),
      setDeleted: guard('setDeleted', (id: string, at: string | null) => {
        const v = find(id);
        if (!v) throw new Error('setDeleted: the row does not exist');
        const before = v.deletedAt;
        v.deletedAt = at;
        journal.push(() => { v.deletedAt = before; });
      }),
      purgeDeletedBefore: guard('purgeDeletedBefore', (iso: string) => {
        const gone = state.views.filter((v) => v.deletedAt !== null && v.deletedAt < iso);
        state.views = state.views.filter((v) => !gone.includes(v));
        journal.push(() => { state.views.push(...gone); });
        return gone.length;
      }),
      recordAction: guard('recordAction', (actor, line) => {
        const row: HistoryEntryRow = { id: `h-${(n += 1)}`, seq: n, subjectType: line.subjectType, subjectId: line.subjectId, action: line.action, changes: structuredClone(line.changes ?? {}), actor, at: new Date(NOON + n * 1000).toISOString() };
        state.history.push(row);
        journal.push(() => { state.history = state.history.filter((h) => h.id !== row.id); });
        return row.id;
      }),
      historyEntry: guard('historyEntry', (id: string) => { const h = state.history.find((x) => x.id === id); return h ? structuredClone(h) : null; }),
      setHistoryChanges: guard('setHistoryChanges', (id: string, changes: Record<string, unknown>) => {
        const h = state.history.find((x) => x.id === id);
        if (!h) throw new Error('setHistoryChanges: the row does not exist');
        const before = h.changes;
        h.changes = structuredClone(changes);
        journal.push(() => { h.changes = before; });
      }),
    };
  }

  return { state, store, failOn: (method) => failing.add(method) };
}
