import { INSCRIERI_TO, MESAJE_TO, VOLUNTARI_TO, PARTENERI_REZULTATE_TO } from './menu';

/**
 * Shared definitions of the site's public forms, used by both the dashboard
 * "Ce e nou" feed (DashboardPage) and the Formulare hub (FormularePage).
 * Adding a form here makes it appear in both surfaces automatically.
 *
 * Each form declares how its counts are fetched (`countSource`):
 *   - 'formsApiFilters' — dedicated admin endpoint using the JSON `filters`
 *     dialect ([{ col, op, val }]), e.g. /api/forms/inscrieri.
 *   - 'formsApi' — dedicated admin endpoint using a plain `status` param,
 *     e.g. /api/forms/voluntari, /api/forms/parteneri-rezultate.
 *   - 'contentManager' — Strapi content-manager collection API; `nouParams`
 *     holds the filter query that selects "new" entries.
 * All dialects answer with pagination.total, queried with pageSize 1.
 */

export type FormCountSource =
  | { kind: 'formsApi'; api: string }
  | { kind: 'formsApiFilters'; api: string }
  | { kind: 'contentManager'; uid: string; nouParams: Record<string, string> };

export interface AdminFormDef {
  key: string;
  name: string;
  initials: string;
  color: string;
  questions: number;
  mode: 'Tabel' | 'Inbox';
  desc: string;
  live: boolean; // false => "în curând", no results/counts yet
  resultsTo?: string;
  resultsLabel?: string;
  countSource: FormCountSource;
  /** Dashboard feed tile: single initial + colour (kept separate from `color`
      so the existing feed visuals stay exactly as they were). */
  feedTile: string;
  feedColor: string;
  /** Terse destination name for the feed row, e.g. "3 noi · Voluntari". */
  feedName: string;
}

export const FORM_DEFS: AdminFormDef[] = [
  {
    key: 'inscriere',
    name: 'Înscriere cursuri',
    initials: 'ÎC',
    color: '#2138b8',
    questions: 13,
    mode: 'Tabel',
    desc: 'Cererile de înscriere trimise din pagina publică de cursuri.',
    live: true,
    resultsTo: INSCRIERI_TO,
    resultsLabel: 'Rezultate',
    countSource: { kind: 'formsApiFilters', api: '/api/forms/inscrieri' },
    feedTile: 'Î',
    feedColor: '#1f7a4d',
    feedName: 'Înscrieri',
  },
  {
    key: 'contact',
    name: 'Contact',
    initials: 'CT',
    color: '#00838f',
    questions: 4,
    mode: 'Inbox',
    desc: 'Mesajele trimise din formularul de contact.',
    live: true,
    resultsTo: MESAJE_TO,
    resultsLabel: 'Vezi mesajele',
    countSource: {
      kind: 'contentManager',
      uid: 'api::contact-submission.contact-submission',
      nouParams: { 'filters[triageStatus][$eq]': 'new' },
    },
    feedTile: 'M',
    feedColor: '#2138b8',
    feedName: 'Mesaje',
  },
  {
    key: 'voluntariat',
    name: 'Voluntariat',
    initials: 'VO',
    color: '#1f7a4d',
    questions: 19,
    mode: 'Tabel',
    desc: 'Cererile de voluntariat trimise din pagina publică de voluntariat.',
    live: true,
    resultsTo: VOLUNTARI_TO,
    resultsLabel: 'Rezultate',
    countSource: { kind: 'formsApi', api: '/api/forms/voluntari' },
    feedTile: 'V',
    feedColor: '#1f7a4d',
    feedName: 'Voluntari',
  },
  {
    key: 'parteneri',
    name: 'Parteneri',
    initials: 'PA',
    color: '#e08a00',
    questions: 7,
    mode: 'Inbox',
    desc: 'Propunerile de parteneriat trimise din pagina publică de parteneri.',
    live: true,
    resultsTo: PARTENERI_REZULTATE_TO,
    resultsLabel: 'Vezi mesajele',
    countSource: { kind: 'formsApi', api: '/api/forms/parteneri-rezultate' },
    feedTile: 'P',
    feedColor: '#e08a00',
    feedName: 'Parteneri',
  },
];

/** Minimal shape of useFetchClient().get — kept loose to match admin usage. */
type GetClient = (url: string, config?: { params?: Record<string, unknown> }) => Promise<unknown>;

const totalOf = (r: any): number | null =>
  typeof r?.data?.pagination?.total === 'number' ? r.data.pagination.total : null;

const NOU_FILTERS = JSON.stringify([{ col: 'status', op: 'equals', val: 'Nou' }]);

/** Count of "new" entries for a form (status Nou / triage new), null on error. */
export async function fetchNewCount(get: GetClient, def: AdminFormDef): Promise<number | null> {
  const src = def.countSource;
  try {
    if (src.kind === 'formsApiFilters') {
      return totalOf(await get(src.api, { params: { pageSize: 1, filters: NOU_FILTERS } }));
    }
    if (src.kind === 'formsApi') {
      return totalOf(await get(src.api, { params: { pageSize: 1, status: 'Nou' } }));
    }
    return totalOf(
      await get(`/content-manager/collection-types/${src.uid}`, {
        params: { page: 1, pageSize: 1, ...src.nouParams },
      })
    );
  } catch {
    return null;
  }
}

/** Total entry count for a form (same endpoints, no "new" filter), null on error. */
export async function fetchTotalCount(get: GetClient, def: AdminFormDef): Promise<number | null> {
  const src = def.countSource;
  try {
    if (src.kind === 'formsApiFilters' || src.kind === 'formsApi') {
      return totalOf(await get(src.api, { params: { pageSize: 1 } }));
    }
    return totalOf(
      await get(`/content-manager/collection-types/${src.uid}`, { params: { page: 1, pageSize: 1 } })
    );
  } catch {
    return null;
  }
}
