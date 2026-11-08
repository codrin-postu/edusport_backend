import * as React from 'react';
import { getFetchClient, useAuth, useFetchClient } from '@strapi/admin/strapi-admin';
import type { CatalogAnswer } from '../../../../club/tables/catalog-api';
import type { SavedViewRow, TableDefinition, TableResult } from '../../../../club/tables/types';
import { downloadPost } from '../../inscrieri/downloadPdf';
import { strapiDownload } from '../../inscrieri/strapiDownload';

const BASE = '/api/club';
type Wrapped<T> = { data: { data: T; undo?: { actionId: string } | null } };

export type ViewReply = { view: SavedViewRow; toast: string };
export type DeleteReply = { actionId: string | null; toast: string };
export type Format = 'xlsx' | 'csv';

/** The plan 11-4 admin routes of the Tabele tab. Same identity on every render (the fetch client's is not). */
export function useTablesApi() {
  const client = useFetchClient();
  const ref = React.useRef(client);
  ref.current = client;
  const token = useAuth('TablesDownload', (state) => state.token) ?? null;
  const tokenRef = React.useRef(token);
  tokenRef.current = token;
  return React.useMemo(() => {
    const view = (id: string) => `${BASE}/table-views/${encodeURIComponent(id)}`;
    return {
      catalog: async () => ((await ref.current.get(`${BASE}/tables/catalog`)) as Wrapped<CatalogAnswer>).data.data,
      query: async (definition: TableDefinition, signal?: AbortSignal) =>
        ((await ref.current.post(`${BASE}/tables/query`, { definition }, { signal })) as Wrapped<TableResult>).data.data,
      views: async () => ((await ref.current.get(`${BASE}/table-views`)) as Wrapped<SavedViewRow[]>).data.data,
      createView: async (name: string, definition: TableDefinition) =>
        ((await ref.current.post(`${BASE}/table-views`, { name, definition })) as Wrapped<ViewReply>).data.data,
      updateView: async (id: string, body: { name?: string; definition?: TableDefinition }) =>
        ((await ref.current.put(view(id), body)) as Wrapped<ViewReply>).data.data,
      deleteView: async (id: string): Promise<DeleteReply> => {
        const r = ((await ref.current.del(view(id))) as Wrapped<{ deleted: true; toast: string }>).data;
        return { actionId: r.undo?.actionId ?? null, toast: r.data.toast };
      },
      /** The toast's "Anulează": it outlives the screen, so it uses the plain client. */
      undo: async (actionId: string) => ((await getFetchClient().post(`${BASE}/undo`, { actionId })) as Wrapped<{ undone: true }>).data.data,
      /** `name` is the view's name (it names the file and the sheet); an unsaved definition sends none. */
      download: (format: Format, definition: TableDefinition, name: string | null, fallbackName: string) =>
        downloadPost(tokenRef.current, `${BASE}/tables/export`, name ? { definition, format, name } : { definition, format }, fallbackName, strapiDownload()),
    };
  }, []);
}

export type TablesApi = ReturnType<typeof useTablesApi>;
