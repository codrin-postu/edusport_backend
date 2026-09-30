import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { useSaveState, type SaveState } from '../ui';
import {
  changedFields,
  cmCollection,
  cmRelation,
  cmSingle,
  hasDraftAndPublish,
  isNotFound,
  loadSchemas,
  requestError,
  serialize,
  type FetchGet,
  type ModelSchema,
  type SchemaSet,
} from './contentApi';

/**
 * Load and save ONE document through the admin content-manager API: a single
 * type (useSingleType) or one entry of a collection (useCollectionEntry).
 * See docs/admin-ui/CUSTOM-PAGES.md, "How to build a page".
 */

export interface DocumentOptions {
  /**
   * Top-level relation fields to load as entries ({ id, documentId, ... }).
   * The content-manager GET returns relations as `{ count }` only; listed
   * fields are fetched from /content-manager/relations (first 100). A relation
   * that is not listed is never sent on save, so it keeps its stored value.
   * Components, dynamic zones and media need nothing here: they always come
   * populated.
   */
  populate?: string[];
  /**
   * For draft & publish types: publish after every save (the pages have no
   * draft UI yet). Default true. Ignored for types without draft & publish.
   */
  publish?: boolean;
}

export interface DocumentState<T> {
  /** The stored document as last loaded (null while loading or after a load error). */
  data: T | null;
  loading: boolean;
  /** Load failed (the page shows a Notice). */
  error: boolean;
  /** False for a single type never saved yet, or a collection entry being created. */
  exists: boolean;
  /** documentId of the loaded document (null when it does not exist yet). */
  documentId: string | null;
  /** Re-fetch without the loading flag. */
  reload: () => Promise<void>;
  /**
   * Merge `next` over the loaded document and save what changed (see the doc).
   * Runs through saveState.run, so the save bar, the toasts and the error
   * state follow. Resolves true on success, then `data` holds the fresh document.
   */
  save: (next: Partial<T>) => Promise<boolean>;
  /** Wired to save(); spread saveState.bar into <SaveBar />. */
  saveState: SaveState;
  schema: ModelSchema | null;
}

export type SingleTypeState<T> = DocumentState<T>;

export interface CollectionEntryState<T> extends DocumentState<T> {
  /** Permanently delete the entry. Resolves true on success. */
  remove: () => Promise<boolean>;
}

type Target = { kind: 'single' } | { kind: 'entry'; documentId: string | null };

interface Loaded {
  data: Record<string, unknown> | null;
  exists: boolean;
  documentId: string | null;
}

async function loadRelations(
  get: FetchGet,
  uid: string,
  documentId: string,
  schema: ModelSchema,
  fields: string[],
  data: Record<string, unknown>,
): Promise<void> {
  await Promise.all(
    fields.map(async (field) => {
      const attr = schema.attributes[field];
      if (!attr || attr.type !== 'relation') return;
      const r = await get(`${cmRelation(uid, documentId, field)}?page=1&pageSize=100`);
      const results: unknown[] = r?.data?.results ?? [];
      const toOne = /ToOne$|^oneToOne$/i.test(String(attr.relation ?? ''));
      data[field] = toOne ? (results[0] ?? null) : results;
    }),
  );
}

function useDocument<T>(uid: string, target: Target, opts: DocumentOptions = {}) {
  const { get, put, post, del } = useFetchClient();
  const saveState = useSaveState();
  const [state, setState] = React.useState<Loaded>({ data: null, exists: false, documentId: null });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [schemas, setSchemas] = React.useState<SchemaSet | null>(null);

  const populateKey = (opts.populate ?? []).join(',');
  const publish = opts.publish ?? true;
  const entryId = target.kind === 'entry' ? target.documentId : null;
  const isSingle = target.kind === 'single';

  const stateRef = React.useRef(state);
  stateRef.current = state;

  const fetchDoc = React.useCallback(
    async (idOverride?: string | null): Promise<Loaded> => {
      const set = await loadSchemas(get as FetchGet);
      setSchemas(set);
      const schema = set.contentTypes[uid];
      const id = idOverride !== undefined ? idOverride : entryId;
      if (!isSingle && !id) return { data: {}, exists: false, documentId: null };
      let doc: Record<string, unknown>;
      try {
        const r: any = await get(isSingle ? cmSingle(uid) : `${cmCollection(uid)}/${id}`);
        doc = { ...(r?.data?.data ?? {}) };
      } catch (e) {
        // A single type that was never saved answers 404: start empty, PUT creates it.
        if (isSingle && isNotFound(e)) return { data: {}, exists: false, documentId: null };
        throw e;
      }
      const documentId = typeof doc.documentId === 'string' ? doc.documentId : null;
      const fields = populateKey ? populateKey.split(',') : [];
      if (documentId && schema && fields.length) await loadRelations(get as FetchGet, uid, documentId, schema, fields, doc);
      return { data: doc, exists: Boolean(documentId), documentId };
    },
    [get, uid, entryId, isSingle, populateKey],
  );

  React.useEffect(() => {
    let off = false;
    setLoading(true);
    setError(false);
    fetchDoc()
      .then((loaded) => {
        if (!off) setState(loaded);
      })
      .catch((e) => {
        console.error('[edusport] load failed', uid, e);
        if (!off) setError(true);
      })
      .finally(() => {
        if (!off) setLoading(false);
      });
    return () => {
      off = true;
    };
  }, [fetchDoc, uid]);

  const reload = React.useCallback(async () => {
    setState(await fetchDoc(stateRef.current.documentId ?? entryId));
  }, [fetchDoc, entryId]);

  const save = React.useCallback(
    (next: Partial<T>): Promise<boolean> =>
      saveState.run(async () => {
        const set = schemas ?? (await loadSchemas(get as FetchGet));
        const schema = set.contentTypes[uid];
        if (!schema) throw new Error(`Tipul ${uid} nu există.`);
        const cur = stateRef.current;
        const body = serialize(changedFields(cur.data, next as Record<string, unknown>), schema.attributes, set);
        const dp = publish && hasDraftAndPublish(schema);
        let documentId = cur.documentId;
        try {
          if (isSingle) {
            if (Object.keys(body).length > 0 || !cur.exists) await put(cmSingle(uid), body);
            if (dp) await post(`${cmSingle(uid)}/actions/publish`, {});
          } else if (!documentId) {
            const r: any = await post(cmCollection(uid), body);
            documentId = r?.data?.data?.documentId ?? null;
            if (dp && documentId) await post(`${cmCollection(uid)}/${documentId}/actions/publish`, {});
          } else {
            if (Object.keys(body).length > 0) await put(`${cmCollection(uid)}/${documentId}`, body);
            if (dp) await post(`${cmCollection(uid)}/${documentId}/actions/publish`, {});
          }
        } catch (e) {
          throw requestError(e);
        }
        setState(await fetchDoc(isSingle ? undefined : documentId));
      }),
    [saveState, schemas, get, put, post, uid, publish, isSingle, fetchDoc],
  );

  const remove = React.useCallback(
    (): Promise<boolean> =>
      saveState.run(async () => {
        const id = stateRef.current.documentId;
        if (!id) return;
        try {
          await del(isSingle ? cmSingle(uid) : `${cmCollection(uid)}/${id}`);
        } catch (e) {
          throw requestError(e, 'Nu am putut șterge. Încearcă din nou.');
        }
        setState({ data: {}, exists: false, documentId: null });
      }),
    [saveState, del, uid, isSingle],
  );

  return {
    data: state.data as T | null,
    loading,
    error,
    exists: state.exists,
    documentId: state.documentId,
    reload,
    save,
    remove,
    saveState,
    schema: schemas?.contentTypes[uid] ?? null,
  };
}

/**
 * A single type, e.g. `useSingleType<TeamPage>(UID.teamPage)`.
 * A type never saved yet loads as `{}` with exists=false; save() creates it.
 */
export function useSingleType<T = Record<string, unknown>>(uid: string, opts: DocumentOptions = {}): SingleTypeState<T> {
  const { remove: _remove, ...rest } = useDocument<T>(uid, { kind: 'single' }, opts);
  return rest;
}

/**
 * One collection entry, for a collection's own edit page (`?id=<documentId>`).
 * documentId null = a new entry: data is `{}`, the first save() creates it and
 * `documentId` then holds the new id (navigate to `?id=` with replace).
 */
export function useCollectionEntry<T = Record<string, unknown>>(
  uid: string,
  documentId: string | null,
  opts: DocumentOptions = {},
): CollectionEntryState<T> {
  return useDocument<T>(uid, { kind: 'entry', documentId }, opts);
}
