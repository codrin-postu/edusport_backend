import { PAGE_SIZE, listQueryString, type ListState } from './list-view';

/** The cards a phone holds: one view (season, search, filters, sort) up to one page. */
export type LoadedPages = { view: string; page: number };
export type ListRequest = { query: string; append: boolean; loaded: LoadedPages };

const viewOf = (s: ListState): string => listQueryString({ ...s, page: 1 }, PAGE_SIZE.phone);

/**
 * Desktop: one page of 50. Phone: page P is appended only right after page P-1 of the same view;
 * otherwise (a remembered page, a desktop page carried to a phone) pages 1..P come in one request.
 */
export function listRequest(s: ListState, phone: boolean, loaded: LoadedPages | null): ListRequest {
  const view = viewOf(s);
  const next = { view, page: s.page };
  if (!phone) return { query: listQueryString(s, PAGE_SIZE.desktop), append: false, loaded: next };
  if (s.page > 1 && loaded?.view === view && loaded.page === s.page - 1) {
    return { query: listQueryString(s, PAGE_SIZE.phone), append: true, loaded: next };
  }
  return { query: listQueryString({ ...s, page: 1 }, PAGE_SIZE.phone * s.page), append: false, loaded: next };
}
