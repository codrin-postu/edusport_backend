import { describe, expect, it } from 'vitest';
import type { PaymentRowView } from '../../presence/money-api';
import { activeSections } from '../../ui-filters';
import { platiCells, platiColumns, platiSections, totalLine } from '../plati-view';

const paymentView = (o: Partial<PaymentRowView>): PaymentRowView => ({
  paymentId: 'p1', athleteId: 'a1', athleteName: 'Ana Ionescu', paidOn: '2026-10-27', purpose: 'abonament', purposeText: 'Abonament', method: 'numerar',
  collectedAtRink: false, receiptNo: null, amount: 100, recordedBy: 'Admin 1', cancelled: false, for: { kind: 'altceva' }, note: null, ...o,
});

describe('Plăți view', () => {
  it('filters and total (5.10, C62)', () => {
    const s = platiSections({ month: '2026-10', method: null, purpose: null }, '2026-11-20');
    expect(s.map((x) => x.label)).toEqual(['Perioadă', 'Metodă', 'Tip']);
    expect(s[0].options[0]).toEqual({ value: '2026-11', label: 'Noiembrie 2026' });
    expect(s[0].options).toHaveLength(24);
    expect(s[0].selected).toEqual(['2026-10']);
    expect(s[1].options.map((o) => o.label)).toEqual(['Numerar', 'Card (POS)', 'Transfer bancar']);
    expect(s[2].options.map((o) => o.label)).toEqual(['Abonament', 'Cotizație membru', 'Club', 'Lecție individuală', 'Altceva']);
    expect(s.map((x) => x.allLabel)).toEqual([null, undefined, undefined]);   // Toate rows come from the panel
    expect(activeSections(s)).toBe(0);
    expect(activeSections(platiSections({ month: '2026-10', method: 'card', purpose: 'club_luna' }, '2026-11-20'))).toBe(2);   // M1: Metodă and Tip count
    expect(totalLine({ rows: [], total: 840 })).toBe('Total: 840 RON');
  });
});

describe('Receipt number column (11-5 5.7)', () => {
  it('"Nr. chitanță" follows "Data"; empty for an older payment', () => {
    expect(platiColumns()).toEqual(['Data', 'Nr. chitanță', 'Sportiv', 'Pentru', 'Metodă', 'Sumă', 'Înregistrat de']);
    expect(platiCells(paymentView({ receiptNo: '2026-0042' })).receipt).toBe('2026-0042');
    expect(platiCells(paymentView({ purposeText: 'Abonament A-0124' })).purpose).toBe('Abonament A-0124');
  });
});
