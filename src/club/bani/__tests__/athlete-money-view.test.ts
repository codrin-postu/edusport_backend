import { describe, expect, it } from 'vitest';
import type { AthletePayments } from '../../presence/money-api';
import { groupLines, monthCells, paymentsReadOnly } from '../athlete-money-view';

describe('athlete money tabs (5.7)', () => {
  it('group lines: the main group says so', () => {
    expect(groupLines({ groups: [{ name: 'Intermediari Bronze', main: true }, { name: 'Uscat juniori', main: false }], current: null, others: [] }))
      .toEqual(['Intermediari Bronze, principală', 'Uscat juniori']);
  });

  it('month table cells', () => {
    expect(monthCells({ month: '2026-10', grup: 6, uscat: 2, lessons: 1, due: 360, paid: 200, left: 160, lines: [] }))
      .toEqual({ month: 'Octombrie 2026', sessions: '9 (6 grup, 2 uscat, 1 individuală)', due: '360 RON', paid: '200 RON', left: '160 RON', advance: null });
    expect(monthCells({ month: '2026-10', grup: 1, uscat: 0, lessons: 0, due: 40, paid: 100, left: -60, lines: [] })).toMatchObject({ left: '0 RON', advance: 'Avans: 60 RON' });
  });

  it('payments are read-only as the server says', () => {
    const p = (readOnly: boolean): AthletePayments => ({ months: [], payments: [], hasEmail: false, readOnly });
    expect([paymentsReadOnly(p(true)), paymentsReadOnly(p(false))]).toEqual([true, false]);
  });
});
