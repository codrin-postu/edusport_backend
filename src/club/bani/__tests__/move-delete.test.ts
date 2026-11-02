import { describe, expect, it } from 'vitest';
import type { AthletePayments, AthleteSubscriptions, PaymentRowView } from '../../presence/money-api';
import { isBlocked, readRefusal, refusalCounts } from '../delete-refusal';
import { payPreselect, rowMenuItems } from '../../prezenta/panel-view';
import { moveBarView } from '../move-bar';

const bar = { subscriptionId: 's', itemName: 'Abonament 8 ședințe', slots: 8, used: 5, validUntil: '2026-11-07' };
const paymentsOf = (rows: { cancelled: boolean }[]): AthletePayments => ({
  months: [], payments: rows.map((r) => ({ ...r }) as PaymentRowView), hasEmail: false, readOnly: false,
});
const none: AthleteSubscriptions = { groups: [], bars: [], earlier: [] };

describe('move and delete (5.12, 5.14)', () => {
  it('the move bar and the Gold line only when the carry happens (5.12)', () => {
    expect(moveBarView({ bar, carries: true })).toEqual({ bar, goldLine: true });
    expect(moveBarView({ bar, carries: false })).toEqual({ bar, goldLine: false });
    expect(moveBarView({ bar: null, carries: false })).toEqual({ bar: null, goldLine: false });
    expect(moveBarView(null)).toEqual({ bar: null, goldLine: false });
  });

  it('delete refusal counts: cancelled payments and every abonament count (5.14, C37)', () => {
    const c = refusalCounts(paymentsOf([{ cancelled: true }, { cancelled: false }]), { groups: [], bars: [bar], earlier: [] });
    expect(c).toEqual({ payments: 2, subscriptions: 1 });
    expect([isBlocked(c), isBlocked({ payments: 0, subscriptions: 0 })]).toEqual([true, false]);
  });

  it('counts are zero while nothing is loaded', () => {
    expect(refusalCounts(null, null)).toEqual({ payments: 0, subscriptions: 0 });
    expect(refusalCounts(paymentsOf([]), none)).toEqual({ payments: 0, subscriptions: 0 });
  });

  it('a 409 from DELETE carries the counts; anything else is not a refusal', () => {
    const fail = (status: number, data: unknown) => ({ status, response: { data: { data } } });
    expect(readRefusal(fail(409, { payments: 2, subscriptions: 1 }))).toEqual({ payments: 2, subscriptions: 1 });
    expect(readRefusal(fail(409, { documentId: 'x' }))).toBeNull();
    expect(readRefusal(fail(500, { payments: 2, subscriptions: 1 }))).toBeNull();
    expect(readRefusal(null)).toBeNull();
  });

  it('the panel row menu: abonament only for Școala; "+ Plată" preselects the abonament or the Club month (5.3, C44)', () => {
    expect(rowMenuItems('school').map((i) => i.text)).toEqual(['Adaugă abonament', '+ Plată']);
    expect(rowMenuItems('club').map((i) => i.text)).toEqual(['+ Plată']);
    expect(payPreselect('school', '2026-10-20', 's1')).toEqual({ kind: 'abonament', subscriptionId: 's1' });
    expect(payPreselect('school', '2026-10-20', null)).toBeNull();
    expect(payPreselect('club', '2026-10-20', null)).toEqual({ kind: 'club_luna', month: '2026-10' });
  });
});
