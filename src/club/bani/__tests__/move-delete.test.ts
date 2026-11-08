import { describe, expect, it } from 'vitest';
import type { PanelRow } from '../../presence/attendance/api-types';
import type { AthletePayments, AthleteSubscriptionCards, PaymentRowView } from '../../presence/money-api';
import { anonymizeOffered, isBlocked, readRefusal, refusalCounts } from '../delete-refusal';
import { lessonMenuItems, lessonPayPreselect, payPreselect, refreshAbonamentLines, rowMenuItems, rowSubLines } from '../../prezenta/panel-view';
import { moveBarView } from '../move-bar';

const bar = { subscriptionId: 's', itemName: 'Abonament 8 ședințe', slots: 8, used: 5, validUntil: '2026-11-07' };
const paymentsOf = (rows: { cancelled: boolean }[]): AthletePayments => ({
  months: [], payments: rows.map((r) => ({ ...r }) as PaymentRowView), hasEmail: false, readOnly: false,
});
const none: AthleteSubscriptionCards = { groups: [], current: null, others: [] };
const card = { id: 's', code: 'A-0001', label: 'Abonament 8 ședințe', startsOn: '2026-10-10', validUntil: '2026-11-07', state: 'activ' as const, used: 5, slots: 8, uses: [] };

describe('move and delete (5.12, 5.14)', () => {
  it('lesson panel row menu: "+ Plată" only, this lesson preselected once saved and present (5.5, I3)', () => {
    expect(lessonMenuItems()).toEqual([{ key: 'payment', text: '+ Plată' }]);
    expect(lessonPayPreselect({ lessonId: 'l1', state: 'saved', present: true })).toEqual({ kind: 'lectie', lessonId: 'l1' });
    expect(lessonPayPreselect({ lessonId: 'l1', state: 'saved', present: false })).toBeNull();
    expect(lessonPayPreselect({ lessonId: 'l1', state: 'planned', present: null })).toBeNull();
  });

  it('after a money write only the abonament lines change; ticks, visitors and added rows stay (I5)', () => {
    const row = (o: Partial<PanelRow>): PanelRow => ({ athleteId: 'a', name: 'A', visitor: false, inactive: false, mainGroup: null, abonament: null, grup: false, uscat: false, noSubscription: false, ...o });
    const draft = [row({ athleteId: 'a1', grup: true, noSubscription: true, abonament: 'Fără abonament' }), row({ athleteId: 'v1', visitor: true, grup: true })];
    const fresh = [row({ athleteId: 'a1', grup: false, abonament: '7 ședințe rămase', noSubscription: false })];
    expect(refreshAbonamentLines(draft, fresh)).toEqual([row({ athleteId: 'a1', grup: true, abonament: '7 ședințe rămase', noSubscription: false }), draft[1]]);
  });

  it('"Fără abonament" is shown once under a name', () => {
    expect(rowSubLines({ abonament: 'Fără abonament', noSubscription: true })).toEqual({ status: null, warn: 'Fără abonament' });
    expect(rowSubLines({ abonament: '3 ședințe rămase', noSubscription: false })).toEqual({ status: '3 ședințe rămase', warn: null });
    expect(rowSubLines({ abonament: '3 ședințe rămase', noSubscription: true })).toEqual({ status: '3 ședințe rămase', warn: 'Fără abonament' });
    expect(rowSubLines({ abonament: null, noSubscription: false })).toEqual({ status: null, warn: null });
  });

  it('the move bar and the Gold line only when the carry happens (5.12)', () => {
    expect(moveBarView({ bar, carries: true })).toEqual({ bar, goldLine: true });
    expect(moveBarView({ bar, carries: false })).toEqual({ bar, goldLine: false });
    expect(moveBarView({ bar: null, carries: false })).toEqual({ bar: null, goldLine: false });
    expect(moveBarView(null)).toEqual({ bar: null, goldLine: false });
  });

  it('delete refusal counts: cancelled payments and every abonament count (5.14, C37)', () => {
    const c = refusalCounts(paymentsOf([{ cancelled: true }, { cancelled: false }]), { groups: [], current: card, others: [] });
    expect(c).toEqual({ payments: 2, subscriptions: 1 });
    expect(refusalCounts(null, { groups: [], current: card, others: [card, card] }).subscriptions).toBe(3);
    expect(refusalCounts(null, { groups: [], current: null, others: [card] }).subscriptions).toBe(1);
    expect([isBlocked(c), isBlocked({ payments: 0, subscriptions: 0 })]).toEqual([true, false]);
  });

  it('a plain admin sees no anonymize hint nor button, a Super Admin does (C67)', () => {
    expect([anonymizeOffered(true), anonymizeOffered(false)]).toEqual([true, false]);
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
