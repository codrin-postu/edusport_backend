/**
 * A minimal global `strapi` for the Sheets tests: form-config meta, a document store per content type, a logger.
 * Only what src/sheets touches is faked.
 */
import { vi } from 'vitest';

export type FormMetaFake = { removedBuiltins: string[]; customs: { key: string; label: string; type?: string }[] };
export type Doc = Record<string, unknown> & { documentId: string };

type FindArgs = { filters?: { documentId?: { $in?: string[] } }; populate?: unknown };

export function installStrapi(docs: Doc[], meta: FormMetaFake = { removedBuiltins: [], customs: [] }) {
  const findMany = vi.fn(async (args: FindArgs = {}) => {
    const ids = args.filters?.documentId?.$in;
    return ids ? docs.filter((d) => ids.includes(d.documentId)) : [...docs];
  });
  const fake = {
    service: () => ({ adminFormMeta: async () => meta }),
    documents: () => ({ findMany, count: async () => docs.length }),
    log: { info: () => undefined, warn: () => undefined, error: () => undefined },
  };
  (globalThis as unknown as { strapi: unknown }).strapi = fake;
  return { findMany };
}
