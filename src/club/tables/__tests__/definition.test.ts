import { describe, expect, it } from 'vitest';
import { CATALOG } from '../catalog';
import { readDefinition, repairDefinition } from '../definition';
import { MAX_PERIOD_MONTHS, monthsIn, resolvePeriod } from '../period';
import { READY_MADE } from '../ready-made';
import type { TableDefinition } from '../types';

const base: TableDefinition = { subject: 'plati', scope: { seasonId: 's1', sectionId: null, groupId: null, period: { kind: 'current' } }, columns: ['data', 'suma'], filters: [], groupBy: null, sort: null };
const bad = (definition: unknown): boolean => readDefinition({ definition }).ok;
const withFilter = (f: unknown): unknown => ({ ...base, filters: [f] });

describe('readDefinition', () => {
  it('accepts only catalog keys and allowed ops', () => {
    expect(readDefinition({ definition: base })).toEqual({ ok: true, value: base });
    for (const b of [
      { ...base, subject: 'users' }, { ...base, columns: ['data', 'athlete.email'] }, { ...base, columns: [] },
      { ...base, columns: Array.from({ length: 21 }, () => 'data') }, { ...base, filters: [{ column: 'suma', op: 'in', value: ['1'] }] },
      { ...base, filters: [{ column: 'suma', op: 'gt', value: 'drop table' }] }, { ...base, groupBy: 'luna', subject: 'sportivi', columns: ['sportiv'] },
      { ...base, sort: { column: 'nota', dir: 'asc' } }, { ...base, scope: { ...base.scope, period: { from: '2026-01-01', to: '2027-12-31' } } },
    ]) expect(readDefinition({ definition: b }).ok, JSON.stringify(b)).toBe(false);
    expect(bad({ ...base, filters: Array.from({ length: 11 }, () => ({ column: 'suma', op: 'gt', value: 1 })) })).toBe(false);
    expect(bad({ ...base, columns: ['data'], extra: 'x'.repeat(17000) })).toBe(false);
  });

  it('answers 400 "Cerere invalidă." and rejects non-objects', () => {
    expect(readDefinition({ definition: null })).toEqual({ ok: false, status: 400, error: 'Cerere invalidă.' });
    for (const b of [undefined, null, 'x', 5, [], [base], {}]) expect(readDefinition(b).ok).toBe(false);
    for (const d of [undefined, null, 'x', 5, [], true]) expect(bad(d)).toBe(false);
  });

  it('rejects prototype and path keys as subject or column', () => {
    for (const k of ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'a.b', "x'; drop table--", 'data ', 'DATA']) {
      expect(bad({ ...base, subject: k }), k).toBe(false);
      expect(bad({ ...base, columns: [k] }), k).toBe(false);
      expect(bad(withFilter({ column: k, op: 'empty' })), k).toBe(false);
      expect(bad({ ...base, sort: { column: k, dir: 'asc' } }), k).toBe(false);
    }
    expect(bad(JSON.parse('{"subject":"plati","__proto__":{"x":1},"scope":{"seasonId":"s1","sectionId":null,"groupId":null,"period":null},"columns":["data"],"filters":[],"groupBy":null,"sort":null}'))).toBe(false);
  });

  it('rejects wrong shapes, extra keys and non-string columns', () => {
    for (const b of [
      { ...base, columns: 'data' }, { ...base, columns: [1] }, { ...base, columns: ['data', 'data'] }, { ...base, columns: [null] },
      { ...base, filters: 'x' }, { ...base, filters: [null] }, { ...base, filters: [[]] }, { ...base, filters: [{ column: 'suma', op: 'gt', value: 1, extra: 1 }] },
      { ...base, groupBy: 'zi' }, { ...base, groupBy: ['grupa'] }, { ...base, groupBy: undefined },
      { ...base, sort: 'suma' }, { ...base, sort: { column: 'suma', dir: 'up' } }, { ...base, sort: { column: 'suma' } }, { ...base, sort: { column: 'suma', dir: 'asc', x: 1 } },
      { ...base, scope: null }, { ...base, scope: { ...base.scope, seasonId: '' } }, { ...base, scope: { ...base.scope, seasonId: 5 } },
      { ...base, scope: { ...base.scope, sectionId: 5 } }, { ...base, scope: { ...base.scope, groupId: 'g'.repeat(101) } },
      { ...base, scope: { ...base.scope, extra: 1 } }, { ...base, scope: { seasonId: 's1', sectionId: null, groupId: null } },
    ]) expect(bad(b), JSON.stringify(b)).toBe(false);
  });

  it('checks the period shape', () => {
    const p = (period: unknown): unknown => ({ ...base, scope: { ...base.scope, period } });
    for (const ok of [null, { kind: 'current' }, { kind: 'month', month: '2026-11' }]) expect(bad(p(ok)), JSON.stringify(ok)).toBe(true);
    for (const no of [{ kind: 'month', month: '2026-13' }, { kind: 'month', month: '2026-00' }, { kind: 'month' }, { kind: 'month', month: '2026-1' }, { kind: 'month', month: '2026-11-01' },
      { kind: 'current', month: '2026-11' }, { kind: 'week' }, [], 'current', {}, { kind: 'month', month: 202611 }]) expect(bad(p(no)), JSON.stringify(no)).toBe(false);
  });

  it('allows only the ops of the column type', () => {
    const ok = (column: string, op: string, value?: unknown): boolean => bad(withFilter(value === undefined ? { column, op } : { column, op, value }));
    expect(ok('suma', 'gt', 10)).toBe(true);
    expect(ok('suma', 'eq', 10.5)).toBe(true);
    expect(ok('suma', 'empty')).toBe(true);
    expect(ok('nota', 'in', ['a'])).toBe(true);
    expect(ok('nota', 'eq', 'a')).toBe(true);
    expect(ok('nota', 'notEmpty')).toBe(true);
    expect(ok('metoda', 'in', ['Numerar', 'Card (POS)'])).toBe(true);
    expect(ok('data', 'lt', '2026-11-30')).toBe(true);
    expect(ok('data', 'lt', '+14d')).toBe(true);
    expect(ok('nota', 'gt', 'a')).toBe(false);
    expect(ok('nota', 'lt', 'a')).toBe(false);
    expect(ok('metoda', 'gt', 'Numerar')).toBe(false);
    expect(ok('suma', 'in', [1])).toBe(false);
    expect(ok('data', 'in', ['2026-11-01'])).toBe(false);
    expect(ok('suma', 'nope')).toBe(false);
    expect(ok('suma', '')).toBe(false);
    expect(ok('suma', 'GT', 1)).toBe(false);
    expect(ok('suma', 'toString', 1)).toBe(false);
  });

  it('checks filter values against the column type', () => {
    const ok = (column: string, op: string, value?: unknown): boolean => bad(withFilter({ column, op, value }));
    for (const v of ['1', null, NaN, Infinity, -Infinity, [], {}, true, undefined]) expect(ok('suma', 'gt', v), String(v)).toBe(false);
    expect(ok('suma', 'empty', 1)).toBe(false);
    expect(ok('suma', 'notEmpty', 'x')).toBe(false);
    for (const v of ['2026-02-30', '2026-13-01', '26-01-01', '2026-1-1', '+d', '+14', '14d', '+14days', '+-1d', '+99999d', "2026-01-01'; --", 20260101, '']) expect(ok('data', 'gt', v), String(v)).toBe(false);
    expect(ok('metoda', 'eq', 'Cash')).toBe(false);
    expect(ok('metoda', 'in', ['Numerar', 'Cash'])).toBe(false);
    expect(ok('metoda', 'in', [])).toBe(false);
    expect(ok('metoda', 'in', ['Numerar', 5])).toBe(false);
    expect(ok('metoda', 'in', Array.from({ length: 51 }, () => 'Numerar'))).toBe(false);
    expect(ok('nota', 'eq', 'x'.repeat(201))).toBe(false);
    expect(ok('nota', 'eq', 'x'.repeat(200))).toBe(true);
    expect(ok('nota', 'in', ['x'.repeat(201)])).toBe(false);
    expect(ok('nota', 'eq', 5)).toBe(false);
    expect(ok('grupa', 'eq', 'Mini 1')).toBe(true);
    expect(ok('grupa', 'eq', 'x'.repeat(201))).toBe(false);
  });

  it('allows a group-by of the subject only and a sort on a chosen column', () => {
    expect(bad({ ...base, groupBy: 'luna' })).toBe(true);
    expect(bad({ ...base, groupBy: 'antrenor' })).toBe(true);
    expect(bad({ ...base, subject: 'sportivi', columns: ['sportiv'], groupBy: 'grupa' })).toBe(true);
    expect(bad({ ...base, sort: { column: 'suma', dir: 'desc' } })).toBe(true);
    expect(bad({ ...base, sort: { column: 'data', dir: 'desc' }, columns: ['suma'] })).toBe(false);
  });

  it('keeps the size limit at 16 KB and the columns at 20', () => {
    const all = CATALOG.sportivi.columns.map((c) => c.key);
    expect(bad({ ...base, subject: 'sportivi', columns: all })).toBe(true);
    expect(bad({ ...base, filters: Array.from({ length: 10 }, () => ({ column: 'suma', op: 'gt', value: 1 })) })).toBe(true);
    const long = Array.from({ length: 10 }, () => ({ column: 'nota', op: 'eq', value: 'y'.repeat(200) }));
    expect(bad({ ...base, filters: long })).toBe(true);
    expect(bad({ ...base, filters: long.map((f) => ({ ...f, value: [f.value, f.value, f.value, f.value, f.value, f.value, f.value, f.value], op: 'in' })) })).toBe(false);
  });
});

describe('the 16 KB cap counts UTF-8 bytes', () => {
  it('refuses a definition of diacritics that is under 16 K characters but over 16 KB', () => {
    const filters = Array.from({ length: 10 }, () => ({ column: 'nota', op: 'in', value: Array.from({ length: 50 }, () => 'ă'.repeat(28)) }));
    const d = { ...base, filters };
    expect(JSON.stringify(d).length).toBeLessThan(16 * 1024);
    expect(new TextEncoder().encode(JSON.stringify(d)).length).toBeGreaterThan(16 * 1024);
    expect(bad(d)).toBe(false);
    const ascii = { ...base, filters: filters.map((f) => ({ ...f, value: f.value.map((v) => 'a'.repeat(v.length)) })) };
    expect(bad(ascii)).toBe(true);
  });
});

describe('repairDefinition', () => {
  const known = { seasons: ['s1'], sections: [], groups: [] };
  it('repairs a stale saved view with notices, never blocks', () => {
    const r = repairDefinition({ ...base, columns: ['data', 'gone'], scope: { ...base.scope, groupId: 'g-old' } }, known);
    expect(r.definition?.columns).toEqual(['data']);
    expect(r.definition?.scope.groupId).toBeNull();
    expect(r.notices).toHaveLength(2);
  });
  it('drops filters on gone columns, a gone sort, a bad group-by and a missing section', () => {
    const r = repairDefinition({ ...base, columns: ['data', 'suma'], filters: [{ column: 'gone', op: 'empty' }, { column: 'suma', op: 'gt', value: 1 }], sort: { column: 'gone', dir: 'asc' }, groupBy: 'zi', scope: { ...base.scope, sectionId: 'x' } }, known);
    expect(r.definition?.filters).toEqual([{ column: 'suma', op: 'gt', value: 1 }]);
    expect(r.definition?.sort).toBeNull();
    expect(r.definition?.groupBy).toBeNull();
    expect(r.definition?.scope.sectionId).toBeNull();
    expect(r.notices.length).toBeGreaterThanOrEqual(3);
  });
  it('falls back to the first (current) season and keeps present groups', () => {
    const r = repairDefinition({ ...base, scope: { ...base.scope, seasonId: 'old', groupId: 'g1' } }, { seasons: ['s2', 's1'], sections: [], groups: ['g1'] });
    expect(r.definition?.scope.seasonId).toBe('s2');
    expect(r.definition?.scope.groupId).toBe('g1');
  });
  it('is clean for a healthy view and yields null for garbage', () => {
    expect(repairDefinition(base, known)).toEqual({ definition: base, notices: [] });
    for (const g of [null, 'x', 5, {}, { ...base, subject: 'users' }, { ...base, columns: ['gone'] }]) expect(repairDefinition(g, known).definition).toBeNull();
    expect(repairDefinition(base, { seasons: [], sections: [], groups: [] }).definition).toBeNull();
  });
  it('always returns a definition readDefinition accepts', () => {
    const r = repairDefinition({ ...base, filters: [{ column: 'suma', op: 'gt', value: 'bad' }, { column: 'suma', op: 'in', value: [1] }], scope: { ...base.scope, period: { kind: 'x' } } }, known);
    expect(r.definition && readDefinition({ definition: r.definition }).ok).toBe(true);
    expect(r.definition?.filters).toEqual([]);
  });
});

describe('resolvePeriod', () => {
  const season = { start: '2026-09-01', end: '2027-08-31' };
  it('resolves relative periods and keeps them inside the season', () => {
    expect(resolvePeriod({ kind: 'current' }, season, '2026-11-06')).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(resolvePeriod(null, season, '2026-11-06')).toEqual({ from: '2026-09-01', to: '2027-08-31' });
    expect(resolvePeriod({ kind: 'month', month: '2027-02' }, season, '2026-11-06')).toEqual({ from: '2027-02-01', to: '2027-02-28' });
    expect(resolvePeriod({ kind: 'month', month: '2028-02' }, { start: '2027-09-01', end: '2028-08-31' }, '2028-03-01')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });
  it('clips a month that sticks out of the season; an outside month is empty (from after to)', () => {
    expect(resolvePeriod({ kind: 'month', month: '2026-08' }, { start: '2026-08-15', end: '2027-08-31' }, '2026-11-06')).toEqual({ from: '2026-08-15', to: '2026-08-31' });
    const out = resolvePeriod({ kind: 'current' }, season, '2026-07-10');
    expect(out.from > out.to).toBe(true);
  });
  it('counts months', () => {
    expect(MAX_PERIOD_MONTHS).toBe(12);
    expect(monthsIn({ from: '2026-09-01', to: '2027-08-31' })).toBe(12);
    expect(monthsIn({ from: '2026-11-01', to: '2026-11-30' })).toBe(1);
    expect(monthsIn({ from: '2026-09-01', to: '2027-09-01' })).toBe(13);
  });
});

describe('ready-made views', () => {
  it('every ready-made view is valid', () => {
    for (const v of READY_MADE) expect(readDefinition({ definition: v.definition }).ok, v.name).toBe(true);
  });
  it('are read only, authored by the system, and have the rm- ids', () => {
    expect(READY_MADE.map((v) => v.id)).toEqual(['rm-plati-grupa', 'rm-prezenta-grupa', 'rm-sportivi-activi', 'rm-ramas', 'rm-expira', 'rm-sportivi-plati']);
    for (const v of READY_MADE) expect(v).toMatchObject({ readyMade: true, canDelete: false, mine: false, authorId: null, authorName: 'Sistem' });
  });
});
