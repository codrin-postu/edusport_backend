import { PAGE_SIZE, listQueryString, type ListState } from './list-view';

/** The cards a phone holds: one view (season, search, filters, sort) up to one page. */
export type LoadedPages = { view: string; page: number };
export type ListRequest = { query: string; append: boolean; loaded: LoadedPages };

const viewOf = (s: ListState): string => listQueryString({ ...s, page: 1 }, PAGE_SIZE.phone);

/** The most phone pages one reload brings: 30 * 40 = 1200 rows, the server's largest page. */
export const PHONE_RELOAD_MAX_PAGES = 40;

/**
 * Desktop: one page of 50. Phone: page P is appended only right after page P-1 of the same view;
 * otherwise (a remembered page, a desktop page carried to a phone) pages 1..P come in one request,
 * and past 40 pages the cards start again at page 1 (`loaded.page` then differs from `s.page`).
 */
export function listRequest(s: ListState, phone: boolean, loaded: LoadedPages | null): ListRequest {
  const view = viewOf(s);
  const next = { view, page: s.page };
  if (!phone) return { query: listQueryString(s, PAGE_SIZE.desktop), append: false, loaded: next };
  if (s.page > 1 && loaded?.view === view && loaded.page === s.page - 1) {
    return { query: listQueryString(s, PAGE_SIZE.phone), append: true, loaded: next };
  }
  const pages = s.page > PHONE_RELOAD_MAX_PAGES ? 1 : s.page;
  return { query: listQueryString({ ...s, page: 1 }, PAGE_SIZE.phone * pages), append: false, loaded: { view, page: pages } };
}
