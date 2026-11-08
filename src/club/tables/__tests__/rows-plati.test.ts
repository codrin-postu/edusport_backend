import { describe, expect, it } from 'vitest';
import { paymentRow } from '../../presence/__tests__/fake-store';
import { platiRows } from '../rows-plati';
import { loadSources } from '../sources';
import { definition, NOVEMBER, spied, tablesSeed } from './tables-seed';

async function run(extra: Parameters<typeof paymentRow>[0][] = [], scope: Partial<ReturnType<typeof definition>['scope']> = {}) {
  const f = tablesSeed();
  f.state.payments.push(...extra.map((p) => paymentRow(p)));
  f.group.admins['admin@example.com'] = 'Ana Admin';
  const d = definition({ subject: 'plati' });
  const dd = { ...d, scope: { ...d.scope, ...scope } };
  const { store, calls } = spied(f.store);
  const src = await loadSources(store, dd, NOVEMBER);
  return { out: platiRows(src, dd, NOVEMBER), calls };
}

describe('Plăți rows', () => {
  it('give one row per payment with paidOn in the period, cancelled ones kept as "anulată"', async () => {
    const { out } = await run([{ id: 'pc', athleteId: 'a3', amount: 50, purpose: 'altceva', note: 'o ședință la intrare ieri sus', paidOn: '2026-11-09', cancelled: true, receiptNo: '2026-0412' }]);
    expect(out.map((r) => [r.cells.data, r.cells.suma, r.cells.stare])).toEqual([['2026-11-02', 320, null], ['2026-11-03', 220, 'anulată'], ['2026-11-09', 50, 'anulată'], ['2026-11-15', 80, null]]);
    const cancelled = out.find((r) => r.cells.data === '2026-11-09');
    expect(cancelled?.cells).toMatchObject({ nrChitanta: '2026-0412', pentru: 'Altceva, o ședință la intrare', nota: 'o ședință la intrare ieri sus', sportiv: 'Ioana Dinu' });
  });
  it('leaves nrChitanta null for a payment before go-live and fills the other cells', async () => {
    const { out } = await run();
    const first = out[0];
    expect(first.cells).toMatchObject({
      nrChitanta: null, sportiv: 'Ana Ionescu', grupa: 'Intermediari Bronze', pentru: 'Abonament A-0001', metoda: 'Numerar', laPatinoar: 'Nu', inregistratDe: 'Ana Admin', nota: null,
    });
    expect(String(first.cells.sectiune)).toContain('AFI');
    expect(out.find((r) => r.cells.suma === 80)?.cells.pentru).toBe('Club, noiembrie');
  });
  it('sets the group keys: main group, section, month and the first coach', async () => {
    const { out } = await run();
    expect(out[0].groupKeys).toEqual({
      grupa: [{ key: 'g-ib', label: 'Intermediari Bronze' }], sectiune: [{ key: 'afi', label: out[0].cells.sectiune }], antrenor: [{ key: 'tm-virgil', label: 'Virgil Pascu' }],
      luna: [{ key: '2026-11', label: 'Noiembrie 2026' }],
    });
  });
  it('restricts to the members of the scope group (Ana is a second-group member) and reads each table once', async () => {
    const { out, calls } = await run([], { groupId: 'g-av' });
    expect(out.map((r) => r.cells.sportiv)).toEqual(['Ana Ionescu', 'Dan Radu']);
    for (const [name, n] of Object.entries(calls)) expect(n, name).toBeLessThanOrEqual(1);
  });
  it('shows an unknown recorder by e-mail', async () => {
    const { out } = await run([{ id: 'px', athleteId: 'a4', paidOn: '2026-11-20', recordedBy: 'x@example.com' }]);
    expect(out.find((r) => r.cells.data === '2026-11-20')?.cells.inregistratDe).toBe('x@example.com');
  });
});
