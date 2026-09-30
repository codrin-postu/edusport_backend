import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { useSaveState, type SaveState } from '../ui';
import {
  changedFields,
  cmCollection,
  cmRelation,
  hasDraftAndPublish,
  loadSchemas,
  requestError,
  serialize,
  type FetchGet,
  type ModelSchema,
} from './contentApi';

/**
 * A whole collection through the admin content-manager API: the list plus
 * create / update / delete, and reorder when the type has an `order` field.
 * See docs/admin-ui/CUSTOM-PAGES.md, "How to build a page".
 */

export interface CollectionOptions {
  /**
   * Top-level relation fields to load as entries per row (one request per row
   * and field, first 100 each). The list GET returns to-many relations as
   * `{ count }`; unlisted relations are never sent, so they keep their value.
   */
  populate?: string[];
  /** Content-manager sort, e.g. 'name:ASC'. Default: `order:ASC` when the type has an order field. */
  sort?: string;
  /** Rows per request; every page is loaded. Default 100. */
  pageSize?: number;
  /** Draft & publish types: publish after create / update. Default true. */
  publish?: boolean;
}

/** Every row carries its ids. */
export type Row<T> = T & { id: number; documentId: string };

export interface CollectionState<T> {
  items: Row<T>[];
  loading: boolean;
  error: boolean;
  /** Re-fetch the list without the loading flag. */
  reload: () => Promise<void>;
  /** Create an entry. Resolves the created row (null on failure). */
  create: (data: Partial<T>) => Promise<Row<T> | null>;
  /** Merge `next` over the loaded row and save what changed. */
  update: (documentId: string, next: Partial<T>) => Promise<boolean>;
  /** Permanently delete an entry. */
  remove: (documentId: string) => Promise<boolean>;
  /**
   * Save a new order: `order` = index for every row in `next` whose value
   * changes (only those are written). Needs `orderField`; rejects otherwise.
   */
  reorder: (next: Row<T>[]) => Promise<boolean>;
  /** 'order' when the type has an integer order field, else null. */
  orderField: string | null;
  /** Every mutation runs through saveState.run (saving flag, toasts, error). */
  saveState: SaveState;
  schema: ModelSchema | null;
}

const ORDER_TYPES = new Set(['integer', 'biginteger', 'float', 'decimal']);

export function useCollection<T = Record<string, unknown>>(uid: string, opts: CollectionOptions = {}): CollectionState<T> {
  const { get, put, post, del } = useFetchClient();
  const saveState = useSaveState();
  const [items, setItems] = React.useState<Row<T>[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [schema, setSchema] = React.useState<ModelSchema | null>(null);

  const pageSize = opts.pageSize ?? 100;
  const publish = opts.publish ?? true;
  const populateKey = (opts.populate ?? []).join(',');
  const sortOpt = opts.sort;

  const itemsRef = React.useRef(items);
  itemsRef.current = items;

  const orderField = schema && ORDER_TYPES.has(String(schema.attributes.order?.type)) ? 'order' : null;

  const fetchAll = React.useCallback(async (): Promise<Row<T>[]> => {
    const set = await loadSchemas(get as FetchGet);
    const s = set.contentTypes[uid] ?? null;
    setSchema(s);
    const hasOrder = s ? ORDER_TYPES.has(String(s.attributes.order?.type)) : false;
    const sort = sortOpt ?? (hasOrder ? 'order:ASC' : '');
    const rows: Row<T>[] = [];
    for (let page = 1; page <= 50; page += 1) {
      const q = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (sort) q.set('sort', sort);
      const r: any = await get(`${cmCollection(uid)}?${q.toString()}`);
      rows.push(...((r?.data?.results ?? []) as Row<T>[]));
      const pageCount = Number(r?.data?.pagination?.pageCount ?? 1);
      if (page >= pageCount) break;
    }
    const fields = populateKey ? populateKey.split(',') : [];
    if (s && fields.length) {
      await Promise.all(
        rows.map(async (row) => {
          const rec = row as Record<string, unknown>;
          await Promise.all(
            fields.map(async (field) => {
              const attr = s.attributes[field];
              if (!attr || attr.type !== 'relation') return;
              const r: any = await get(`${cmRelation(uid, row.documentId, field)}?page=1&pageSize=100`);
              const results: unknown[] = r?.data?.results ?? [];
              rec[field] = /ToOne$|^oneToOne$/i.test(String(attr.relation ?? '')) ? (results[0] ?? null) : results;
            }),
          );
        }),
      );
    }
    return rows;
  }, [get, uid, pageSize, sortOpt, populateKey]);

  React.useEffect(() => {
    let off = false;
    setLoading(true);
    setError(false);
    fetchAll()
      .then((rows) => {
        if (!off) setItems(rows);
      })
      .catch((e) => {
        console.error('[edusport] list load failed', uid, e);
        if (!off) setError(true);
      })
      .finally(() => {
        if (!off) setLoading(false);
      });
    return () => {
      off = true;
    };
  }, [fetchAll, uid]);

  const reload = React.useCallback(async () => {
    setItems(await fetchAll());
  }, [fetchAll]);

  const context = React.useCallback(async () => {
    const set = await loadSchemas(get as FetchGet);
    const s = set.contentTypes[uid];
    if (!s) throw new Error(`Tipul ${uid} nu există.`);
    return { set, s, dp: publish && hasDraftAndPublish(s) };
  }, [get, uid, publish]);

  const create = React.useCallback(
    async (data: Partial<T>): Promise<Row<T> | null> => {
      let created: Row<T> | null = null;
      const ok = await saveState.run(async () => {
        const { set, s, dp } = await context();
        try {
          const r: any = await post(cmCollection(uid), serialize(data as Record<string, unknown>, s.attributes, set));
          created = (r?.data?.data ?? null) as Row<T> | null;
          if (dp && created?.documentId) await post(`${cmCollection(uid)}/${created.documentId}/actions/publish`, {});
        } catch (e) {
          throw requestError(e);
        }
        setItems(await fetchAll());
      });
      return ok ? created : null;
    },
    [saveState, context, post, uid, fetchAll],
  );

  const update = React.useCallback(
    (documentId: string, next: Partial<T>): Promise<boolean> =>
      saveState.run(async () => {
        const { set, s, dp } = await context();
        const loaded = itemsRef.current.find((row) => row.documentId === documentId) as Record<string, unknown> | undefined;
        const body = serialize(changedFields(loaded, next as Record<string, unknown>), s.attributes, set);
        try {
          if (Object.keys(body).length > 0) await put(`${cmCollection(uid)}/${documentId}`, body);
          if (dp) await post(`${cmCollection(uid)}/${documentId}/actions/publish`, {});
        } catch (e) {
          throw requestError(e);
        }
        setItems(await fetchAll());
      }),
    [saveState, context, put, post, uid, fetchAll],
  );

  const remove = React.useCallback(
    (documentId: string): Promise<boolean> =>
      saveState.run(async () => {
        try {
          await del(`${cmCollection(uid)}/${documentId}`);
        } catch (e) {
          throw requestError(e, 'Nu am putut șterge. Încearcă din nou.');
        }
        setItems((rows) => rows.filter((row) => row.documentId !== documentId));
      }),
    [saveState, del, uid],
  );

  const reorder = React.useCallback(
    (next: Row<T>[]): Promise<boolean> =>
      saveState.run(async () => {
        const { s, dp } = await context();
        if (!ORDER_TYPES.has(String(s.attributes.order?.type))) throw new Error('Tipul nu are câmp de ordine.');
        const previous = itemsRef.current;
        setItems(next); // optimistic, so the dragged row stays where it was dropped
        try {
          for (let i = 0; i < next.length; i += 1) {
            const row = next[i] as Record<string, unknown>;
            if (row.order === i) continue;
            await put(`${cmCollection(uid)}/${next[i].documentId}`, { order: i });
            if (dp) await post(`${cmCollection(uid)}/${next[i].documentId}/actions/publish`, {});
          }
        } catch (e) {
          setItems(previous);
          throw requestError(e, 'Nu am putut salva ordinea. Încearcă din nou.');
        }
        setItems(await fetchAll());
      }),
    [saveState, context, put, post, uid, fetchAll],
  );

  return { items, loading, error, reload, create, update, remove, reorder, orderField, saveState, schema };
}
