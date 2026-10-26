import { describe, expect, it } from 'vitest';
import { listRequest } from '../list-pages';
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
});
