import { describe, expect, it } from 'vitest';
import { attendanceRow, lessonRow } from '../../presence/__tests__/fake-store';
import { prezentaRows } from '../rows-prezenta';
import { loadSources } from '../sources';
import { definition, NOVEMBER, spied, tablesSeed } from './tables-seed';

async function run(scope: Partial<ReturnType<typeof definition>['scope']> = {}) {
  const f = tablesSeed();
  f.state.lessons.push(
    lessonRow({ id: 'l1', athleteId: 'a6', date: '2026-11-10', startTime: '16:00', state: 'saved', present: true, amount: 100, price: 100, coachIds: ['tm-andreea'] }),
    lessonRow({ id: 'l2', athleteId: 'a6', date: '2026-11-11', startTime: '16:00', state: 'saved', present: false, amount: 100, coachIds: ['tm-andreea'] }),
    lessonRow({ id: 'l3', athleteId: 'a4', date: '2026-11-12', startTime: '16:00', state: 'planned', present: null }),
  );
  f.state.attendances.push(attendanceRow({ id: 't9', sessionId: 's2', athleteId: 'a2', uniqueKey: 's2|a2', billing: 'fara_abonament', amount: 0 }));
  const d = definition({ subject: 'prezenta' });
  const dd = { ...d, scope: { ...d.scope, ...scope } };
  const { store, calls } = spied(f.store);
  const src = await loadSources(store, dd, NOVEMBER);
  return { out: prezentaRows(src, dd, NOVEMBER), calls };
}
const row = (out: Awaited<ReturnType<typeof run>>['out'], sportiv: string, data: string) => out.find((r) => r.cells.sportiv === sportiv && r.cells.data === data);

describe('Prezență rows', () => {
  it('give one row per attendance and per held lesson, the absent and planned lessons left out', async () => {
    const { out } = await run();
    expect(out.map((r) => `${r.cells.data} ${r.cells.sportiv} ${r.cells.tip}`)).toEqual([
      '2026-11-06 Dan Radu Grup', '2026-11-06 Eva Tudor Grup', '2026-11-07 Ana Ionescu Grup', '2026-11-10 Radu Stan Individual',
      '2026-11-13 Dan Radu Grup', '2026-11-14 Ana Ionescu Grup', '2026-11-14 Mihai Pop Grup',
    ]);
    expect(out.some((r) => r.cells.data === '2026-11-11')).toBe(false);
    expect(out.some((r) => r.cells.data === '2026-11-12')).toBe(false);
  });
  it('lists one group-key entry per coach: a session with two coaches is one row', async () => {
    const { out } = await run();
    const r = row(out, 'Dan Radu', '2026-11-13');
    expect(r?.groupKeys.antrenor).toEqual([{ key: 'tm-andreea', label: 'Andreea Pascu' }, { key: 'tm-virgil', label: 'Virgil Pascu' }]);
    expect(r?.cells.antrenor).toBe('Andreea Pascu, Virgil Pascu');
    expect(out.filter((x) => x.cells.data === '2026-11-13' && x.cells.sportiv === 'Dan Radu')).toHaveLength(1);
  });
  it('writes "Plată" as the athlete card does: unit, Plătit, Neplătit', async () => {
    const { out } = await run();
    expect(row(out, 'Ana Ionescu', '2026-11-07')?.cells.plata).toBe('Ședința 1/8 A-0001');
    expect(row(out, 'Ana Ionescu', '2026-11-14')?.cells.plata).toBe('Ședința 2/8 A-0001');
    expect(row(out, 'Dan Radu', '2026-11-06')?.cells.plata).toBe('Plătit');
    expect(row(out, 'Eva Tudor', '2026-11-06')?.cells.plata).toBe('Neplătit');
    expect(row(out, 'Mihai Pop', '2026-11-14')?.cells.plata).toBe('Neplătit');
    expect(row(out, 'Radu Stan', '2026-11-10')?.cells.plata).toBe('Neplătit');
  });
  it('fills time, group, amount and the other group keys', async () => {
    const { out } = await run();
    const r = row(out, 'Dan Radu', '2026-11-06');
    expect(r?.cells).toMatchObject({ ora: '17:00', grupa: 'Avansați', suma: 40, tip: 'Grup', antrenor: 'Andreea Pascu' });
    expect(r?.groupKeys.luna).toEqual([{ key: '2026-11', label: 'Noiembrie 2026' }]);
    expect(r?.groupKeys.grupa).toEqual([{ key: 'g-av', label: 'Avansați' }]);
    expect(row(out, 'Radu Stan', '2026-11-10')?.cells).toMatchObject({ ora: '16:00', grupa: null, suma: 100, antrenor: 'Andreea Pascu' });
  });
  it('restricts to the scope group and reads each table once', async () => {
    const { out, calls } = await run({ groupId: 'g-ib' });
    expect(new Set(out.map((r) => r.cells.sportiv))).toEqual(new Set(['Ana Ionescu', 'Mihai Pop']));
    for (const [name, n] of Object.entries(calls)) expect(n, name).toBeLessThanOrEqual(1);
  });
});
