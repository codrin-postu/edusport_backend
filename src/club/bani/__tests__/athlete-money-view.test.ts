import { describe, expect, it } from 'vitest';
import type { AthletePayments } from '../../presence/money-api';
import { attendanceLine, earlierLines, groupLines, monthCells, paymentsReadOnly } from '../athlete-money-view';

describe('athlete money tabs (5.7)', () => {
  it('groups, earlier abonamente, attendance rows (p5 Q42)', () => {
    const s = {
      groups: [{ name: 'Intermediari Bronze', main: true }, { name: 'Uscat juniori', main: false }], bars: [],
      earlier: [{ itemName: 'Abonament 8 ședințe', startsOn: '2026-09-29', validUntil: '2026-10-26', used: 8, slots: 8, state: 'epuizat' as const }],
    };
    expect(groupLines(s)).toEqual(['Intermediari Bronze, principală', 'Uscat juniori']);
    expect(earlierLines(s)).toEqual(['Abonament 8 ședințe, 29 sep 2026 - 26 oct 2026, 8/8, epuizat']);
    expect(attendanceLine({ sessionId: 's1', date: '2026-10-20', groupName: 'Intermediari Bronze', types: 'Grup', noSubscription: true }))
      .toEqual({ text: 'Mar 20 oct, Intermediari Bronze, Grup', uncovered: ', Fără abonament' });
    expect(attendanceLine({ sessionId: 's1', date: '2026-10-20', groupName: 'Intermediari Bronze', types: 'Grup', noSubscription: false }).uncovered).toBeNull();
  });

  it('month table cells', () => {
    expect(monthCells({ month: '2026-10', grup: 6, uscat: 2, lessons: 1, due: 360, paid: 200, left: 160, lines: [] }))
      .toEqual({ month: 'Octombrie 2026', sessions: '9 (6 grup, 2 uscat, 1 individuală)', due: '360 RON', paid: '200 RON', left: '160 RON' });
  });

  it('payments are read-only as the server says', () => {
    const p = (readOnly: boolean): AthletePayments => ({ months: [], payments: [], hasEmail: false, readOnly });
    expect([paymentsReadOnly(p(true)), paymentsReadOnly(p(false))]).toEqual([true, false]);
  });
});
