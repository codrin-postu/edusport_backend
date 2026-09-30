/**
 * Shared plumbing for the data hooks (useSingleType, useCollection,
 * useCollectionEntry): schema lookup, the content-manager admin URLs, the
 * payload serializer and the "what changed" diff.
 *
 * Everything goes through the admin content-manager API
 * (/content-manager/...), authenticated by useFetchClient, the same client
 * the older custom pages use. No public /api route is needed.
 *
 * What the content-manager GET returns (Strapi 5.52, read from
 * @strapi/content-manager/dist/server/controllers):
 *   - single type and collection findOne: populated deep (components, dynamic
 *     zones, media all the way down), relations as `{ count: n }` only;
 *   - collection list: populated one level deep, to-many relations as counts.
 * What the PUT / POST accepts (document service, core/dist/services/document-service):
 *   - only the attributes present in the body are touched; a missing key keeps
 *     its stored value (components.mjs `if (!has(attributeName, data)) continue`,
 *     update validation is notNull, not required);
 *   - a component object with `id` updates that component in place, without
 *     `id` creates a new one; a repeatable / dynamic zone array replaces the
 *     list (components whose id is missing from it are deleted);
 *   - media as a file id (single) or an array of ids (multiple);
 *   - relations as `{ set | connect | disconnect }`.
 */

export type Attribute = {
  type: string;
  multiple?: boolean;
  repeatable?: boolean;
  component?: string;
  components?: string[];
  relation?: string;
  target?: string;
  [key: string]: unknown;
};

export interface ModelSchema {
  uid: string;
  kind?: 'singleType' | 'collectionType';
  options?: { draftAndPublish?: boolean; [key: string]: unknown };
  attributes: Record<string, Attribute>;
}

export interface SchemaSet {
  contentTypes: Record<string, ModelSchema>;
  components: Record<string, ModelSchema>;
}

/** The `get` of useFetchClient, loosely typed (its generics vary between Strapi versions). */
export type FetchGet = (url: string, config?: unknown) => Promise<{ data: any }>;

// ---- URLs -------------------------------------------------------------------
export const cmSingle = (uid: string) => `/content-manager/single-types/${uid}`;
export const cmCollection = (uid: string) => `/content-manager/collection-types/${uid}`;
export const cmRelation = (uid: string, documentId: string, field: string) =>
  `/content-manager/relations/${uid}/${documentId}/${field}`;

// ---- schema -----------------------------------------------------------------
let schemaPromise: Promise<SchemaSet> | null = null;

/**
 * Every content type and component schema, from /content-manager/init,
 * fetched once per admin session and shared by all hooks.
 */
export function loadSchemas(get: FetchGet): Promise<SchemaSet> {
  if (!schemaPromise) {
    schemaPromise = get('/content-manager/init')
      .then((r) => {
        const d = r?.data?.data ?? {};
        const byUid = (list: ModelSchema[] = []) => Object.fromEntries(list.map((m) => [m.uid, m]));
        return { contentTypes: byUid(d.contentTypes), components: byUid(d.components) };
      })
      .catch((e) => {
        schemaPromise = null; // retry on the next call
        throw e;
      });
  }
  return schemaPromise;
}

export function hasDraftAndPublish(schema: ModelSchema | undefined): boolean {
  return Boolean(schema?.options?.draftAndPublish);
}

// ---- serializer -------------------------------------------------------------

/** Document-level keys that are never sent back. */
const META_KEYS = new Set([
  'id',
  'documentId',
  'createdAt',
  'updatedAt',
  'publishedAt',
  'createdBy',
  'updatedBy',
  'locale',
  'localizations',
  'status',
]);

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function mediaId(v: unknown): number | string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' || typeof v === 'string') return v;
  if (isObj(v) && (typeof v.id === 'number' || typeof v.id === 'string')) return v.id;
  return null;
}

/**
 * Relation value as loaded (`{ count }`) means "not loaded": omit it so the
 * stored relation stays. An array of entries becomes `{ set }`. A value that
 * is already `{ set | connect | disconnect }` passes through.
 */
function relationPayload(v: unknown): unknown | undefined {
  if (v === null) return { set: [] };
  if (isObj(v)) {
    if ('set' in v || 'connect' in v || 'disconnect' in v) return v;
    if ('count' in v && Object.keys(v).length === 1) return undefined;
    // a single to-one entry
    const ref = relationRef(v);
    return ref ? { set: [ref] } : undefined;
  }
  if (Array.isArray(v)) {
    return { set: v.map(relationRef).filter(Boolean) };
  }
  if (typeof v === 'number' || typeof v === 'string') return { set: [relationRef(v)] };
  return undefined;
}

function relationRef(v: unknown): { id: number | string } | { documentId: string } | null {
  if (typeof v === 'number') return { id: v };
  if (typeof v === 'string') return { documentId: v };
  if (isObj(v)) {
    if (typeof v.id === 'number' || typeof v.id === 'string') return { id: v.id };
    if (typeof v.documentId === 'string') return { documentId: v.documentId };
  }
  return null;
}

/**
 * Turn loaded (or edited) data into what the content-manager PUT / POST
 * expects: media -> ids, relations -> `{ set }` (loaded counts dropped),
 * components and dynamic zones recursed (their `id` kept so they update in
 * place), document meta keys removed at the top level, `__temp_key__`
 * removed everywhere. Keys the schema does not know are dropped.
 */
export function serialize(
  data: Record<string, unknown>,
  attributes: Record<string, Attribute>,
  schemas: SchemaSet,
  top = true,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === '__temp_key__') continue;
    if (top && META_KEYS.has(key)) continue;
    if (!top && (key === 'id' || key === '__component')) {
      if (value !== undefined && value !== null) out[key] = value;
      continue;
    }
    const attr = attributes[key];
    if (!attr) continue;
    if (value === undefined) continue;
    switch (attr.type) {
      case 'password':
        break;
      case 'media':
        out[key] = attr.multiple
          ? (Array.isArray(value) ? value : value === null ? [] : [value]).map(mediaId).filter((x) => x !== null)
          : mediaId(value);
        break;
      case 'relation': {
        const rel = relationPayload(value);
        if (rel !== undefined) out[key] = rel;
        break;
      }
      case 'component': {
        const comp = schemas.components[attr.component ?? '']?.attributes ?? {};
        if (attr.repeatable) {
          out[key] = (Array.isArray(value) ? value : []).map((item) =>
            isObj(item) ? serialize(item, comp, schemas, false) : item,
          );
        } else {
          out[key] = isObj(value) ? serialize(value, comp, schemas, false) : null;
        }
        break;
      }
      case 'dynamiczone':
        out[key] = (Array.isArray(value) ? value : []).filter(isObj).map((item) => {
          const uid = String(item.__component ?? '');
          const comp = schemas.components[uid]?.attributes ?? {};
          return { ...serialize(item, comp, schemas, false), __component: uid };
        });
        break;
      default:
        out[key] = value;
    }
  }
  return out;
}

// ---- diff -------------------------------------------------------------------

/** Structural equality for JSON-like data (key order ignored). */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    // treat undefined / null as equal "empty"
    return (a === null || a === undefined) && (b === null || b === undefined);
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bb = b as unknown[];
    return a.length === bb.length && a.every((v, i) => deepEqual(v, bb[i]));
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
  for (const k of keys) if (!deepEqual(ao[k], bo[k])) return false;
  return true;
}

/**
 * Merge `next` over `loaded` and keep only the top-level keys whose value
 * changed. That set, serialized, is the request body: attributes the page did
 * not touch are not sent at all, so the server keeps them as stored.
 */
export function changedFields(
  loaded: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>,
): Record<string, unknown> {
  const base = loaded ?? {};
  const merged = { ...base, ...next };
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(merged)) {
    if (META_KEYS.has(key)) continue;
    if (!(key in next)) continue;
    if (!deepEqual(base[key], merged[key])) out[key] = merged[key];
  }
  return out;
}

/** Romanian message for a failed request; the server detail goes to the console. */
export function requestError(e: unknown, fallback = 'Nu am putut salva. Încearcă din nou.'): Error {
  const detail = (e as any)?.response?.data?.error;
  if (detail) console.error('[edusport] content-manager request failed', detail);
  else console.error('[edusport] content-manager request failed', e);
  if (detail?.name === 'ValidationError') return new Error('Datele nu sunt valide. Verifică câmpurile și încearcă din nou.');
  return new Error(fallback);
}

export function isNotFound(e: unknown): boolean {
  const err = e as any;
  return err?.status === 404 || err?.response?.status === 404 || err?.response?.data?.error?.status === 404;
}
