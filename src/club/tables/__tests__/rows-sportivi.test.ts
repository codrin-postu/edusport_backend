import { describe, expect, it } from 'vitest';
import { loadSources } from '../sources';
import { sportiviRows } from '../rows-sportivi';
import { definition, NOVEMBER, spied, tablesSeed, TODAY } from './tables-seed';
import type { TableDefinition } from '../types';

async function rows(d: TableDefinition, period = NOVEMBER) {
  const f = tablesSeed();
  const { store, calls } = spied(f.store);
  const src = await loadSources(store, d, period);
  const before = { ...calls };
  const out = sportiviRows(src, d, period, TODAY);
  return { out, calls, noReadAfter: JSON.stringify(calls) === JSON.stringify(before) };
}
const d = definition({ subject: 'sportivi' });
const by = (out: Awaited<ReturnType<typeof rows>>['out'], id: string) => out.find((r) => r.athleteId === id)?.cells;

describe('Sportivi rows', () => {
  it('give de plătit, plătit, rămas and the state per athlete for November', async () => {
    const { out } = await rows(d);
    const money = (id: string) => { const c = by(out, id); return [c?.dePlatit, c?.platit, c?.ramas, c?.starePlata]; };
    expect(money('a1')).toEqual([320, 320, 0, 'Achitat']);
    expect(money('a2')).toEqual([320, 100, 220, 'Parțial']);
    expect(money('a3')).toEqual([260, 0, 260, 'Neachitat']);
    expect(money('a4')).toEqual([80, 80, 0, 'Achitat']);
    expect(money('a5')).toEqual([40, 0, 40, 'Neachitat']);
    expect(money('a6')).toEqual([0, 0, 0, null]);
  });
  it('leaves out the athlete in no group of the scope and orders by name', async () => {
    const { out } = await rows(d);
    expect(out.map((r) => r.athleteId)).not.toContain('a7');
    expect(out.map((r) => r.cells.sportiv)).toEqual(['Ana Ionescu', 'Dan Radu', 'Eva Tudor', 'Ioana Dinu', 'Mihai Pop', 'Radu Stan']);
  });
  it('keeps only the members of a group or section scope', async () => {
    const g = await rows(definition({ subject: 'sportivi', scope: { ...d.scope, groupId: 'g-av' } }));
    expect(g.out.map((r) => r.athleteId).sort()).toEqual(['a1', 'a4', 'a5', 'a6']);
    const s = await rows(definition({ subject: 'sportivi', scope: { ...d.scope, sectionId: 'afi' } }));
    expect(s.out.map((r) => r.athleteId).sort()).toEqual(['a1', 'a2', 'a3']);
    const none = await rows(definition({ subject: 'sportivi', scope: { ...d.scope, groupId: 'nope' } }));
    expect(none.out).toEqual([]);
  });
  it('fills the person, group, abonament and presence cells', async () => {
    const c = by((await rows(d)).out, 'a1');
    expect(c).toMatchObject({
      sportiv: 'Ana Ionescu', varsta: 10, dataNasterii: '2016-03-10', grupa: 'Intermediari Bronze', grupe: 'Intermediari Bronze, Avansați', antrenor: 'Virgil Pascu',
      parinte: 'Maria Ionescu', telefon: '0711', email: 'm@ex.ro', membruAcs: 'Da', stare: 'Activ', abonament: 'A-0001 2/8', expira: '2026-11-29', prezente: 2,
    });
    expect(c?.sectiune).toContain('AFI');
    expect(by((await rows(d)).out, 'a2')).toMatchObject({ membruAcs: 'Nu', abonament: 'A-0002 0/8', prezente: 0, varsta: null, dataNasterii: null });
    expect(by((await rows(d)).out, 'a6')?.abonament).toBeNull();
  });
  it('sets group keys from the main group, its section and first coach', async () => {
    const r = (await rows(d)).out.find((x) => x.athleteId === 'a4');
    expect(r?.groupKeys).toEqual({ grupa: [{ key: 'g-av', label: 'Avansați' }], sectiune: [{ key: 'club', label: 'Club' }], antrenor: [{ key: 'tm-andreea', label: 'Andreea Pascu' }] });
  });
  it('counts the whole season for a null period and ignores a month outside it', async () => {
    const season = { from: '2026-10-01', to: '2027-05-31' };
    const { out } = await rows(definition({ subject: 'sportivi', scope: { ...d.scope, period: null } }), season);
    expect(by(out, 'a1')).toMatchObject({ dePlatit: 640, platit: 320, ramas: 320, prezente: 3 });
  });
  it('reads each store table at most once and nothing per row', async () => {
    const { calls, noReadAfter } = await rows(d);
    for (const [name, n] of Object.entries(calls)) expect(n, name).toBeLessThanOrEqual(1);
    expect(noReadAfter).toBe(true);
  });
  it('is empty for an unknown season', async () => {
    expect((await rows(definition({ subject: 'sportivi', scope: { ...d.scope, seasonId: 'nope' } }))).out).toEqual([]);
  });
});
