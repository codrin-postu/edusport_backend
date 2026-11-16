import { describe, expect, it } from 'vitest';
import { attendanceRow, sessionRow } from '../../presence/__tests__/fake-store';
import { CATALOG } from '../catalog';
import { readDefinition } from '../definition';
import { inPeriod, monthsIn, monthsInSeason, resolvePeriod } from '../period';
import { abonamenteRows } from '../rows-abonamente';
import { platiRows } from '../rows-plati';
import { prezentaRows } from '../rows-prezenta';
import { sedinteTable } from '../rows-sedinte';
import { sportiviRows } from '../rows-sportivi';
import { loadSources } from '../sources';
import { readCatalog, readExportRequest, runTable } from '../service';
import type { TableDefinition } from '../types';
import { definition, TODAY, tablesSeed } from './tables-seed';

const noBudget = { check: () => undefined };
const months = (...m: string[]): TableDefinition['scope']['period'] => ({ kind: 'months', months: m });
const scoped = (subject: TableDefinition['subject'], period: TableDefinition['scope']['period'], extra: Partial<TableDefinition> = {}) =>
  definition({ subject, scope: { seasonId: 's26', sectionId: null, groupId: null, period }, columns: ['sportiv'], ...extra });
const SEASON = { start: '2026-10-01', end: '2027-05-31' };

describe('a period of several months', () => {
  it('is accepted by the definition check only as 1 to 12 real months, oldest first, nothing else', () => {
    const ok = (period: unknown) => readDefinition({ definition: { ...scoped('plati', null, { columns: ['data'] }), scope: { seasonId: 's26', sectionId: null, groupId: null, period } } }).ok;
    expect(ok(months('2026-10', '2026-11'))).toBe(true);
    expect(ok(months('2026-11'))).toBe(true);
    for (const bad of [months(), months('2026-11', '2026-10'), months('2026-11', '2026-11'), months('2026-13'), { kind: 'months', months: 'x' }, { kind: 'months' },
      { kind: 'months', months: ['2026-11'], extra: 1 }, months(...Array.from({ length: 13 }, (_, i) => `2026-${String((i % 12) + 1).padStart(2, '0')}`))]) {
      expect(ok(bad), JSON.stringify(bad)).toBe(false);
    }
  });
  it('resolves to the range of its first and last month, keeps the months, and counts them', () => {
    const p = resolvePeriod(months('2026-10', '2026-12'), SEASON, TODAY);
    expect(p).toEqual({ from: '2026-10-01', to: '2026-12-31', months: ['2026-10', '2026-12'] });
    expect(monthsIn(p)).toBe(2);
    expect(inPeriod('2026-10-15', p)).toBe(true);
    expect(inPeriod('2026-11-15', p)).toBe(false);
    expect(resolvePeriod(months('2026-11'), SEASON, TODAY)).toEqual({ from: '2026-11-01', to: '2026-11-30' });
  });
  it('knows whether its months belong to a season', () => {
    expect(monthsInSeason(months('2026-10', '2027-05'), SEASON)).toBe(true);
    expect(monthsInSeason(months('2026-09', '2026-10'), SEASON)).toBe(false);
    expect(monthsInSeason(null, SEASON)).toBe(true);
  });
});

describe('every subject builds only the chosen months', () => {
  const build = async (d: TableDefinition) => {
    const period = resolvePeriod(d.scope.period, SEASON, TODAY);
    return { src: await loadSources(tablesSeed().store, d, period), period };
  };
  it('Plăți: payments of the named months only, not those between them', async () => {
    const d = scoped('plati', months('2026-11', '2026-12'));
    const { src, period } = await build(d);
    expect(platiRows(src, d, period).map((r) => r.cells.data)).toEqual(['2026-11-02', '2026-11-03', '2026-11-15', '2026-12-01']);
    const only = scoped('plati', months('2026-12'));
    const b = await build(only);
    expect(platiRows(b.src, only, b.period).map((r) => r.cells.data)).toEqual(['2026-12-01']);
    const gap = scoped('plati', months('2026-10', '2026-12'));
    const c = await build(gap);
    expect(platiRows(c.src, gap, c.period).map((r) => r.cells.data)).toEqual(['2026-12-01']);
  });
  it('Abonamente: those starting in a named month', async () => {
    const d = scoped('abonamente', months('2026-10', '2026-11'));
    const { src, period } = await build(d);
    expect(abonamenteRows(src, d, period, TODAY).map((r) => r.cells.cod)).toEqual(['A-0000', 'A-0001', 'A-0002', 'A-0003', 'A-0004']);
    const oct = scoped('abonamente', months('2026-10'));
    const b = await build(oct);
    expect(abonamenteRows(b.src, oct, b.period, TODAY).map((r) => r.cells.cod)).toEqual(['A-0000']);
  });
  it('Prezență: attendances of the named months only', async () => {
    const d = scoped('prezenta', months('2026-10', '2026-11'));
    const { src, period } = await build(d);
    expect(prezentaRows(src, d, period).length).toBe(6);
    const oct = scoped('prezenta', months('2026-10'));
    const b = await build(oct);
    expect(prezentaRows(b.src, oct, b.period).map((r) => r.cells.data)).toEqual(['2026-10-10']);
  });
  it('Sportivi: the money and the attendance count follow the named months', async () => {
    const both = scoped('sportivi', months('2026-10', '2026-11'));
    const a = await build(both);
    const ana = (rows: ReturnType<typeof sportiviRows>) => rows.find((r) => r.athleteId === 'a1')?.cells;
    expect(ana(sportiviRows(a.src, both, a.period, TODAY))?.prezente).toBe(3);
    const nov = scoped('sportivi', months('2026-11'));
    const b = await build(nov);
    expect(ana(sportiviRows(b.src, nov, b.period, TODAY))?.prezente).toBe(2);
  });
});

describe('the service checks the months against the season', () => {
  it('refuses months outside an existing season, keeps those inside, and resets them when the season is gone', async () => {
    const run = (d: TableDefinition) => runTable(tablesSeed().store, { definition: d }, { today: TODAY, budget: noBudget });
    expect(await run(scoped('plati', months('2026-09', '2026-10'), { columns: ['data'] }))).toEqual({ ok: false, status: 400, error: 'Cerere invalidă.' });
    const inside = await run(scoped('plati', months('2026-11', '2026-12'), { columns: ['data'] }));
    expect(inside.ok && inside.data.count).toBe(4);
    const gone = scoped('plati', months('2026-09', '2026-10'), { columns: ['data'] });
    const reset = await run({ ...gone, scope: { ...gone.scope, seasonId: 'deleted' } });
    expect(reset.ok && reset.data.notices).toContain('Perioada a fost resetată.');
  });
  it('Prezență pe ședințe takes exactly one month, none after the current one', async () => {
    const f = tablesSeed();
    const sed = (period: TableDefinition['scope']['period']) => definition({ subject: 'sedinte', columns: ['sportiv', 'total'], scope: { seasonId: 's26', sectionId: null, groupId: 'g-ib', period } });
    const now = { date: TODAY, time: '12:00' };
    for (const p of [months('2026-10', '2026-11'), months('2026-12'), null]) expect(await sedinteTable(f.store, sed(p), TODAY, now), JSON.stringify(p)).toMatchObject({ ok: false, status: 400 });
    expect(await sedinteTable(f.store, sed(months('2026-11')), TODAY, now)).toMatchObject({ ok: true });
  });
});

describe('the name search and multi-value filters of a query', () => {
  const run = (d: TableDefinition, search?: string) => runTable(tablesSeed().store, search === undefined ? { definition: d } : { definition: d, search }, { today: TODAY, budget: noBudget });
  const names = async (d: TableDefinition, search?: string) => { const r = await run(d, search); return r.ok ? r.data.rows.map((x) => x.cells.sportiv) : r; };
  const season = null;
  it('a filter holds several values (is one of) and keeps the rows of any of them', async () => {
    const one = scoped('sportivi', season, { filters: [{ column: 'grupa', op: 'in', value: ['Avansați'] }] });
    expect(await names(one)).toEqual(['Dan Radu', 'Eva Tudor', 'Radu Stan']);
    const two = scoped('sportivi', season, { filters: [{ column: 'grupa', op: 'in', value: ['Avansați', 'Intermediari Bronze'] }] });
    expect((await names(two) as string[]).length).toBe(6);
  });
  it('Antrenor is a filter of Sportivi and Prezență and takes several coaches', async () => {
    expect(CATALOG.sportivi.columns.some((c) => c.key === 'antrenor')).toBe(true);
    const virgil = scoped('sportivi', season, { filters: [{ column: 'antrenor', op: 'in', value: ['Virgil Pascu'] }] });
    expect(await names(virgil)).toEqual(['Ana Ionescu', 'Ioana Dinu', 'Mihai Pop']);
    const both = scoped('sportivi', season, { filters: [{ column: 'antrenor', op: 'in', value: ['Virgil Pascu', 'Andreea Pascu'] }] });
    expect((await names(both) as string[]).length).toBe(6);
    const pres = scoped('prezenta', months('2026-11'), { columns: ['data', 'sportiv', 'antrenor'], filters: [{ column: 'antrenor', op: 'in', value: ['Virgil Pascu'] }] });
    const rows = await run(pres);
    expect(rows.ok && rows.data.rows.length).toBeGreaterThan(0);
    expect(rows.ok && rows.data.rows.every((r) => String(r.cells.antrenor).includes('Virgil Pascu'))).toBe(true);
  });
  it('the other subjects take the same filter on their own fields', async () => {
    const plati = scoped('plati', season, { columns: ['sportiv', 'metoda'], filters: [{ column: 'metoda', op: 'in', value: ['Numerar', 'Card (POS)'] }] });
    const paid = await run(plati);
    expect(paid.ok && paid.data.rows.every((r) => r.cells.metoda === 'Numerar')).toBe(true);
    expect(paid.ok && paid.data.count).toBeGreaterThan(0);
    const abon = scoped('abonamente', season, { columns: ['cod', 'sportiv'], filters: [{ column: 'grupa', op: 'in', value: ['Intermediari Bronze', 'Avansați'] }] });
    expect(await names(abon)).toEqual(['Ana Ionescu', 'Ana Ionescu', 'Mihai Pop', 'Ioana Dinu', 'Radu Stan']);
  });
  it('the search keeps the names that hold every word, without regard to case or diacritics, and totals follow', async () => {
    const d = scoped('sportivi', season, { columns: ['sportiv', 'dePlatit'] });
    expect(await names(d, 'ana')).toEqual(['Ana Ionescu', 'Ioana Dinu']);
    expect(await names(d, '  RADU ')).toEqual(['Dan Radu', 'Radu Stan']);
    expect(await names(d, 'ion ana')).toEqual(['Ana Ionescu']);
    expect(await names(d, 'ștefan')).toEqual([]);
    expect((await names(d, '') as string[]).length).toBe(6);
    expect(await names(d, 'zzz')).toEqual([]);
    const withSum = await run(d, 'ion ana');
    expect(withSum.ok && withSum.data.total.dePlatit).toBe(withSum.ok ? withSum.data.rows[0].cells.dePlatit : null);
  });
  it('a search that is not text or is over 200 characters is refused, also for a file', async () => {
    const d = scoped('sportivi', season);
    expect(await run(d, 5 as unknown as string)).toMatchObject({ ok: false, status: 400 });
    expect(await run(d, 'a'.repeat(201))).toMatchObject({ ok: false, status: 400 });
    expect(readExportRequest({ definition: d, format: 'csv', search: 'ana' })).toMatchObject({ ok: true, data: { search: 'ana' } });
    expect(readExportRequest({ definition: d, format: 'csv', search: 7 })).toMatchObject({ ok: false });
    expect(readExportRequest({ definition: d, format: 'csv' })).toEqual({ ok: true, data: { definition: d, format: 'csv' } });
  });
  it('the catalog lists the coaches of the groups for the Antrenor chip', async () => {
    const cat = await readCatalog(tablesSeed().store, TODAY);
    expect(cat.coaches).toEqual([{ id: 'tm-andreea', name: 'Andreea Pascu' }, { id: 'tm-virgil', name: 'Virgil Pascu' }]);
  });
});

describe('Prezență pe ședințe grid', () => {
  const sed = (groupId: string) => definition({ subject: 'sedinte', columns: ['sportiv', 'total'], scope: { seasonId: 's26', sectionId: null, groupId, period: months('2026-11') } });
  it('heads each session with weekday and day, the time only when two sessions share a day, and counts per session and per athlete', async () => {
    const f = tablesSeed();
    f.state.sessions.push(sessionRow({ id: 's5', groupId: 'g-ib', date: '2026-11-07', startTime: '17:00' }));
    f.state.attendances.push(attendanceRow({ id: 't6', sessionId: 's5', athleteId: 'a2', uniqueKey: 's5|a2' }));
    const res = await runTable(f.store, { definition: sed('g-ib') }, { today: TODAY, budget: noBudget });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const [, ...rest] = res.data.columns;
    expect(rest.map((c) => c.session)).toEqual([
      { weekday: 'Sâ', day: '7', time: '11:00' }, { weekday: 'Sâ', day: '7', time: '17:00' }, { weekday: 'Sâ', day: '14', time: null }, undefined,
    ]);
    expect(rest.map((c) => c.label)).toEqual(['Sâ 7 11:00', 'Sâ 7 17:00', 'Sâ 14', 'Total']);
    const keys = res.data.columns.map((c) => c.key);
    expect(res.data.total[keys[1]]).toBe(1);
    expect(res.data.total[keys[2]]).toBe(1);
    expect(res.data.total[keys[3]]).toBe(1);
    expect(res.data.total.total).toBe(3);
    expect(res.data.rows.find((r) => r.athleteId === 'a2')?.cells.total).toBe(1);
  });
});
