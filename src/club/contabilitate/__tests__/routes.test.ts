import { describe, expect, it } from 'vitest';
import { oldTablesRedirect, readTabeleQuery, tablesTo } from '../../tables/routes';
import { CONTABILITATE_PATH, contabTo, oldMoneyRedirect, readContabQuery } from '../routes';

describe('Contabilitate address', () => {
  it('reads tab and month with defaults and clamping', () => {
    const q = readContabQuery('', '2026-11-12');
    expect([q.tab, q.month]).toEqual(['restante', '2026-11']);
    expect(readContabQuery('?month=2027-01', '2026-11-12').month).toBe('2026-11');
    expect(readContabQuery('?month=2026-10', '2026-11-12').month).toBe('2026-10');
    expect(readContabQuery('?tab=bogus', '2026-11-12').tab).toBe('restante');
    const r = readContabQuery('?tab=plati&month=2026-10&method=cash', '2026-11-12');
    expect(r.tab).toBe('plati');
    expect(Object.fromEntries(r.rest)).toEqual({ method: 'cash' });
  });

  it('writes tab first, then month, then filters', () => {
    expect(contabTo({})).toBe(CONTABILITATE_PATH);
    expect(contabTo({ tab: 'abonamente', params: { state: 'active' } })).toBe(`${CONTABILITATE_PATH}?tab=abonamente&state=active`);
    expect(contabTo({ tab: 'plati', month: '2026-10', params: { a: 'x y' } })).toBe(`${CONTABILITATE_PATH}?tab=plati&month=2026-10&a=x+y`);
  });
});

describe('old money page redirects', () => {
  it('maps each old page to a tab and keeps month and filters', () => {
    expect(oldMoneyRedirect('/plugins/edusport-abonamente', '?state=expira14&group=g1')).toBe(`${CONTABILITATE_PATH}?tab=abonamente&state=expira14&group=g1`);
    expect(oldMoneyRedirect('/plugins/edusport-plati', '?method=cash&month=2026-10')).toBe(`${CONTABILITATE_PATH}?tab=plati&month=2026-10&method=cash`);
    expect(oldMoneyRedirect('/plugins/edusport-de-incasat/x', '?group=g1')).toBe(`${CONTABILITATE_PATH}?tab=restante&group=g1`);
    expect(oldMoneyRedirect('/plugins/edusport-bani', '')).toBe(`${CONTABILITATE_PATH}?tab=restante`);
    expect(oldMoneyRedirect('/plugins/edusport-bani', '?view=prezentare&month=2026-10')).toBe(`${CONTABILITATE_PATH}?tab=restante&month=2026-10`);
    expect(oldMoneyRedirect('/plugins/edusport-bani', '?view=contabilitate&month=2026-10')).toBe(`${CONTABILITATE_PATH}?tab=pe-grupe&month=2026-10`);
  });
  it('is null for other pages', () => {
    expect(oldMoneyRedirect('/plugins/edusport-grupe', '')).toBeNull();
    expect(oldMoneyRedirect('/plugins/edusport-banimore', '')).toBeNull();
  });
});

describe('Tabele address', () => {
  it('writes, reads and redirects', () => {
    expect(tablesTo(null)).toBe('/plugins/edusport-tabele');
    expect(tablesTo('a b/c')).toBe('/plugins/edusport-tabele?v=a%20b%2Fc');
    expect(readTabeleQuery('?v=rm-ramas')).toEqual({ viewId: 'rm-ramas' });
    expect(readTabeleQuery('?v=%20')).toEqual({ viewId: null });
    expect(oldTablesRedirect('?vedere=tabele&v=rm-ramas')).toBe('/plugins/edusport-tabele?v=rm-ramas');
    expect(oldTablesRedirect('?vedere=tabele')).toBe('/plugins/edusport-tabele');
    expect(oldTablesRedirect('?v=x')).toBeNull();
  });
});
