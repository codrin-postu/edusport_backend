import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import type { AthleteField, AthleteStatus } from '../../../club/athlete-data';
import type {
  AthleteCard, AthleteEditResponse, AthleteListPage, AthleteRecord, HistoryLine, MergePreview,
} from '../../../club/athletes/api-types';
import type { AccessAnswer, AccessBlock, BulkPreview } from '../../../club/portal/access/api-types';
import type { BulkAnonymizeResult } from '../../../club/personal-data/anonymize-plan';
import type { InactiveSummary } from '../../../club/personal-data/settings';
import type { EditBody } from '../../../club/sportivi/record-view';
import { searchUrl } from '../../../club/sportivi/search-view';
import { dataOf, detachedClient } from '../inscrieri/useClient';

const BASE = '/api/club/athletes';
const enc = encodeURIComponent;
type Wrapped<T> = { data: { data: T } };
const one = (id: string) => `${BASE}/${enc(id)}`;
const detached = async <T>(url: string, body: unknown): Promise<T> => dataOf<T>(await detachedClient.post(url, body));

/**
 * The plan 3-2 and 3C admin routes the Sportivi screens call. Same identity on every render (the fetch client's is not).
 * Anonymizing goes through the detached client: it can outlive the dialog, and an abort would hide a done write.
 */
export function useSportiviApi() {
  const client = useFetchClient();
  const ref = React.useRef(client);
  ref.current = client;
  return React.useMemo(() => {
    const get = async <T>(url: string): Promise<T> => ((await ref.current.get(url)) as Wrapped<T>).data.data;
    const post = async <T>(url: string, body: unknown): Promise<T> => ((await ref.current.post(url, body)) as Wrapped<T>).data.data;
    const put = async <T>(url: string, body: unknown): Promise<T> => ((await ref.current.put(url, body)) as Wrapped<T>).data.data;
    return {
      list: async (query: string) => (await ref.current.get(`${BASE}?${query}`)).data as AthleteListPage,
      record: (id: string, season: string | null) => get<AthleteRecord>(`${one(id)}${season ? `?season=${enc(season)}` : ''}`),
      history: (id: string) => get<HistoryLine[]>(`${one(id)}/history`),
      update: (id: string, body: EditBody) => put<AthleteEditResponse>(one(id), body),
      setStatus: (id: string, status: 'activ' | 'inactiv') => post<{ status: AthleteStatus }>(`${one(id)}/status`, { status }),
      remove: async (id: string) => { await ref.current.del(one(id)); },
      createProfile: (id: string) => post<AthleteRecord>(`${one(id)}/profile`, {}),
      setVisibility: (id: string, on: boolean) => put<AthleteRecord>(`${one(id)}/profile/visibility`, { on }),
      search: (q: string) => get<AthleteCard[]>(searchUrl(q)),
      add: (body: EditBody) => post<{ documentId: string }>(BASE, body),
      mergePreview: (kept: string, removed: string) => get<MergePreview>(`${BASE}/merge-preview?kept=${enc(kept)}&removed=${enc(removed)}`),
      merge: (keptId: string, removedId: string, take: AthleteField[]) => post<{ documentId: string }>(`${BASE}/merge`, { keptId, removedId, take }),
      dismissDuplicate: (pairId: string) => post<{ pairId: string }>(`/api/club/athlete-duplicates/${enc(pairId)}/dismiss`, {}),
      anonymize: (id: string) => detached<{ documentId: string }>(`${one(id)}/anonymize`, {}),
      anonymizeMany: (documentIds: string[]) => detached<BulkAnonymizeResult>(`${BASE}/anonymize`, { documentIds }),
      inactiveSummary: () => get<InactiveSummary>(`${BASE}/inactive-summary`),
      accessRead: (id: string) => get<AccessBlock>(`${one(id)}/access`),
      accessInvite: (id: string) => post<AccessAnswer>(`${one(id)}/access/invite`, {}),
      accessResend: (id: string) => post<AccessAnswer>(`${one(id)}/access/resend`, {}),
      accessRemove: (id: string) => post<AccessAnswer>(`${one(id)}/access/remove`, {}),
      bulkPreview: (ids: string[]) => post<BulkPreview>(`${BASE}/access/bulk-preview`, { ids }),
      bulkInvite: (ids: string[]) => post<{ sent: number; toast: string }>(`${BASE}/access/bulk-invite`, { ids }),
      hideInactiveReview: () => post<InactiveSummary>(`${BASE}/inactive-summary/hide`, {}),
    };
  }, []);
}

export type SportiviApi = ReturnType<typeof useSportiviApi>;
