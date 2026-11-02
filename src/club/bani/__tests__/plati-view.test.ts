import { describe, expect, it } from 'vitest';
import type { PaymentRowView } from '../../presence/money-api';
import { platiCells, platiSections, rowMenu, totalLine } from '../plati-view';

const paymentView = (o: Partial<PaymentRowView>): PaymentRowView => ({
  paymentId: 'p1', athleteId: 'a1', athleteName: 'Ana Ionescu', paidOn: '2026-10-27', purpose: 'abonament', purposeText: 'Abonament', method: 'numerar',
  collectedAtRink: false, amount: 100, recordedBy: 'Admin 1', cancelled: false, for: { kind: 'altceva' }, note: null, ...o,
});

describe('Plăți view', () => {
  it('cells: rink after the method, cancelled struck with "anulată" (5.10, p5 Q23)', () => {
    expect(platiCells(paymentView({ paidOn: '2026-10-27', athleteName: 'Ana Ionescu', purposeText: 'Abonament 8 ședințe', method: 'numerar', collectedAtRink: true, amount: 320, recordedBy: 'Admin 1' })))
      .toEqual({ date: 'Mar 27 oct', athlete: 'Ana Ionescu', purpose: 'Abonament 8 ședințe', method: 'Numerar, la patinoar', amount: '320 RON', recordedBy: 'Admin 1', struck: false, mark: null });
    const c = paymentView({ cancelled: true, method: 'card', amount: 80 });
    expect([platiCells(c).struck, platiCells(c).mark, platiCells(c).method, rowMenu(c)]).toEqual([true, 'anulată', 'Card (POS)', []]);
    expect(rowMenu(paymentView({}))).toEqual(['edit', 'cancel']);
  });
  it('filters and total (5.10, C62)', () => {
    const s = platiSections({ month: '2026-10', method: null, purpose: null }, '2026-11-20');
    expect(s.map((x) => x.label)).toEqual(['Perioadă', 'Metodă', 'Tip']);
    expect(s[0].options[0]).toEqual({ value: '2026-11', label: 'Noiembrie 2026' });
    expect(s[0].options).toHaveLength(24);
    expect(s[0].selected).toEqual(['2026-10']);
    expect(s[1].options.map((o) => o.label)).toEqual(['Toate', 'Numerar', 'Card (POS)', 'Transfer bancar']);
    expect(s[2].options.map((o) => o.label)).toEqual(['Toate', 'Abonament', 'Cotizație membru', 'Club', 'Lecție individuală', 'Altceva']);
    expect(totalLine({ rows: [], total: 840 })).toBe('Total: 840 RON');
  });
});
