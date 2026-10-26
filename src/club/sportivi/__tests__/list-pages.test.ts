import { describe, expect, it } from 'vitest';
import { PHONE_RELOAD_MAX_PAGES, listRequest } from '../list-pages';
import { INITIAL_LIST_STATE, withPage, withSearch } from '../list-view';

const params = (query: string) => Object.fromEntries(new URLSearchParams(query));

describe('listRequest', () => {
  it('desktop asks for one page of 50 and never appends', () => {
    const r = listRequest(withPage(INITIAL_LIST_STATE, 3), false, null);
    expect(params(r.query)).toMatchObject({ page: '3', pageSize: '50' });
    expect(r.append).toBe(false);
  });

  it('phone page 1 replaces the cards', () => {
    const r = listRequest(INITIAL_LIST_STATE, true, null);
    expect(params(r.query)).toMatchObject({ page: '1', pageSize: '30' });
    expect(r.append).toBe(false);
    expect(r.loaded.page).toBe(1);
  });

  it('phone "Încarcă încă 30" appends the next page of the same view', () => {
    const first = listRequest(INITIAL_LIST_STATE, true, null);
    const r = listRequest(withPage(INITIAL_LIST_STATE, 2), true, first.loaded);
    expect(params(r.query)).toMatchObject({ page: '2', pageSize: '30' });
    expect(r.append).toBe(true);
  });

  it('a remembered phone page 3 with nothing loaded brings pages 1 to 3 in one request', () => {
    const r = listRequest(withPage(INITIAL_LIST_STATE, 3), true, null);
    expect(params(r.query)).toMatchObject({ page: '1', pageSize: '90' });
    expect(r.append).toBe(false);
    expect(r.loaded.page).toBe(3);
  });

  it('a page loaded for another view is never appended to', () => {
    const first = listRequest(INITIAL_LIST_STATE, true, null);
    const r = listRequest(withPage(withSearch(INITIAL_LIST_STATE, 'ana'), 2), true, first.loaded);
    expect(params(r.query)).toMatchObject({ q: 'ana', page: '1', pageSize: '60' });
    expect(r.append).toBe(false);
  });

  it('a phone reload brings at most 40 pages, the server maximum of 1200 rows', () => {
    expect(PHONE_RELOAD_MAX_PAGES).toBe(40);
    const r = listRequest(withPage(INITIAL_LIST_STATE, 40), true, null);
    expect(params(r.query)).toMatchObject({ page: '1', pageSize: '1200' });
    expect(r.loaded.page).toBe(40);
  });

  it('past 40 pages a phone reload starts again at page 1', () => {
    const r = listRequest(withPage(INITIAL_LIST_STATE, 41), true, null);
    expect(params(r.query)).toMatchObject({ page: '1', pageSize: '30' });
    expect(r.append).toBe(false);
    expect(r.loaded.page).toBe(1);
  });

  it('pressing "Încarcă încă 30" past page 40 still appends one page', () => {
    const loaded = { view: listRequest(INITIAL_LIST_STATE, true, null).loaded.view, page: 40 };
    const r = listRequest(withPage(INITIAL_LIST_STATE, 41), true, loaded);
    expect(params(r.query)).toMatchObject({ page: '41', pageSize: '30' });
    expect(r.append).toBe(true);
  });
});
