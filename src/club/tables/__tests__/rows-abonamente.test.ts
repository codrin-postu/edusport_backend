import { describe, expect, it } from 'vitest';
import { abonamenteRows } from '../rows-abonamente';
import { loadSources } from '../sources';
import { definition, NOVEMBER, spied, tablesSeed, TODAY } from './tables-seed';

async function run(period = NOVEMBER, scope: Partial<ReturnType<typeof definition>['scope']> = {}) {
  const d = definition({ subject: 'abonamente' });
  const dd = { ...d, scope: { ...d.scope, ...scope } };
  const { store, calls } = spied(tablesSeed().store);
  const src = await loadSources(store, dd, period);
  return { out: abonamenteRows(src, dd, period, TODAY), calls };
}

describe('Abonamente rows', () => {
  it('give the codes with price, paid, left and state for November', async () => {
    const { out } = await run();
    expect(out.map((r) => [r.cells.cod, r.cells.pret, r.cells.platit, r.cells.ramas, r.cells.stare, r.cells.folosite])).toEqual([
      ['A-0001', 320, 320, 0, 'activ', 2], ['A-0002', 320, 100, 220, 'activ', 0], ['A-0003', 260, 0, 260, 'activ', 0], ['A-0004', 300, 0, 0, 'anulat', 0],
    ]);
  });
  it('counts the non-cancelled payments whenever paid, not the cancelled one', async () => {
    const { out } = await run();
    expect(out.find((r) => r.cells.cod === 'A-0002')?.cells.platit).toBe(100);
  });
  it('uses the season when there is no period and a group scope restricts the athletes', async () => {
    const all = await run({ from: '2026-10-01', to: '2027-05-31' });
    expect(all.out.map((r) => r.cells.cod)).toEqual(['A-0000', 'A-0001', 'A-0002', 'A-0003', 'A-0004']);
    const club = await run(NOVEMBER, { groupId: 'g-av' });
    expect(club.out.map((r) => r.cells.cod)).toEqual(['A-0001', 'A-0004']);
  });
  it('fills the other cells and the group keys including the month', async () => {
    const r = (await run()).out[0];
    expect(r.cells).toMatchObject({ sportiv: 'Ana Ionescu', grupa: 'Intermediari Bronze', abonament: 'Abonament 8 ședințe', inceput: '2026-11-02', expira: '2026-11-29' });
    expect(r.groupKeys.luna).toEqual([{ key: '2026-11', label: 'Noiembrie 2026' }]);
    expect(r.groupKeys.grupa?.[0].key).toBe('g-ib');
  });
  it('reads each table at most once', async () => {
    for (const [name, n] of Object.entries((await run()).calls)) expect(n, name).toBeLessThanOrEqual(1);
  });
});
