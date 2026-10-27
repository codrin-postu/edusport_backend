import { describe, expect, it } from 'vitest';
import { attendanceRow, lessonRow, paymentRow, subscriptionRow } from './fake-store';
import { attendanceStamp, lessonStamp, paymentStamp, presenceLockTargets, readPresenceRecord, subscriptionStamp } from '../undo';

describe('presence undo records', () => {
  it('stamps change when a guarded field changes, and are null for a missing row (decided 5)', () => {
    const sub = subscriptionRow({ id: 'a' });
    expect(subscriptionStamp(sub, 0)).not.toBe(subscriptionStamp(sub, 1));
    expect(subscriptionStamp(sub, 0)).not.toBe(subscriptionStamp({ ...sub, extendedWeeks: 1 }, 0));
    expect(subscriptionStamp(null, 0)).toBeNull();
    const pay = paymentRow({ id: 'p' });
    expect(paymentStamp(pay)).toBe(paymentStamp({ ...pay, recordedAt: 'later' }));
    expect(paymentStamp(pay)).not.toBe(paymentStamp({ ...pay, note: 'x' }));
    expect(lessonStamp(lessonRow({ id: 'l' }), 0)).not.toBe(lessonStamp(lessonRow({ id: 'l' }), 1));
    expect(attendanceStamp(attendanceRow({ id: 't', billing: 'slot', subscriptionId: 'a' }))).not.toBe(attendanceStamp(attendanceRow({ id: 't', billing: 'fara_abonament', subscriptionId: null })));
  });
  it('locks athletes, lessons, subscriptions, payments, each sorted (7.1)', () => {
    expect(presenceLockTargets({ kind: 'presence', subjects: [], athletes: ['a2', 'a1'], guards: [{ type: 'payment', id: 'p2', stamp: null }, { type: 'subscription', id: 's1', stamp: null }],
      steps: [{ op: 'deletePayment', id: 'p1' }, { op: 'deleteLesson', id: 'l1' }, { op: 'setAcs', athleteId: 'a3', seasonId: 's26', state: null }] }))
      .toEqual({ athletes: ['a1', 'a2', 'a3'], lessons: ['l1'], subscriptions: ['s1'], payments: ['p1', 'p2'] });
  });
  it('reads only presence records', () => {
    expect(readPresenceRecord({ kind: 'group', steps: [], subjects: [] })).toBeNull();
    expect(readPresenceRecord({ kind: 'presence', steps: [], subjects: [], athletes: [], guards: [] })?.kind).toBe('presence');
  });
});
