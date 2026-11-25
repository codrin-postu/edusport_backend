import { describe, expect, it } from 'vitest';
import { hostTabItems, sameView, tabAddress, tabFromSearch, tabSearch } from '../tab-hosts';

describe('tab hosts', () => {
  it('reads the open tab from the address', () => {
    expect(tabFromSearch('parteneri', '?tab=sponsori')).toBe('sponsori');
    expect(tabFromSearch('parteneri', '?tab=evenimente')).toBe('evenimente');
    expect(tabFromSearch('istoric', '?tab=momente')).toBe('momente');
  });

  it('falls back to the page form when the tab is missing or foreign', () => {
    expect(tabFromSearch('parteneri', '')).toBe('pagina');
    expect(tabFromSearch('parteneri', '?tab=nope')).toBe('pagina');
    expect(tabFromSearch('parteneri', '?tab=momente')).toBe('pagina');
    expect(tabFromSearch('istoric', '?tab=sponsori')).toBe('pagina');
  });

  it('writes the query back and round-trips', () => {
    expect(tabSearch('pagina')).toBe('');
    expect(tabFromSearch('istoric', tabSearch('momente'))).toBe('momente');
    expect(tabFromSearch('parteneri', tabSearch('evenimente'))).toBe('evenimente');
  });

  it('lists the tabs of each host in order', () => {
    expect(hostTabItems('parteneri').map((t) => t.id)).toEqual(['pagina', 'sponsori', 'evenimente']);
    expect(hostTabItems('istoric').map((t) => t.id)).toEqual(['pagina', 'momente']);
  });

  it('builds the new address of an old list route and keeps other query values', () => {
    expect(tabAddress('/plugins/x', 'sponsori')).toBe('/plugins/x?tab=sponsori');
    expect(tabAddress('/plugins/x', 'momente', '?id=abc')).toBe('/plugins/x?id=abc&tab=momente');
    expect(tabAddress('/plugins/x', 'pagina', '?tab=momente')).toBe('/plugins/x');
  });

  it('treats tab and id changes on one path as the same view, other moves as leaving', () => {
    const base = '/admin/plugins/x';
    expect(sameView(base, `${base}?tab=sponsori`)).toBe(true);
    expect(sameView(`${base}?tab=momente&id=a`, base)).toBe(true);
    expect(sameView(`${base}?tab=momente`, `${base}?tab=momente&id=b`)).toBe(true);
    expect(sameView(base, '/admin/plugins/y')).toBe(false);
    expect(sameView(base, `${base}?other=1`)).toBe(false);
    expect(sameView(`${base}/`, base)).toBe(false);
  });
});
