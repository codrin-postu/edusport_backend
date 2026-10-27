import { describe, expect, it } from 'vitest';
import { attendanceRow, lessonRow, paymentRow, subscriptionRow } from './fake-store';
import { acsGuardId, acsStamp, attendanceStamp, lessonStamp, paymentStamp, presenceLockTargets, readPresenceRecord, subscriptionStamp } from '../undo';

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
      .toEqual({ athletes: ['a1', 'a2', 'a3'], lessons: ['l1'], attendances: [], subscriptions: ['s1'], payments: ['p1', 'p2'] });
  });
  it('locks attendance rows (steps and guards) and the athlete of an A.C.S. guard', () => {
    expect(presenceLockTargets({ kind: 'presence', subjects: [], athletes: [], guards: [{ type: 'attendance', id: 't3', stamp: null }, { type: 'acs', id: acsGuardId('a9', 's26'), stamp: null }],
      steps: [{ op: 'setAttendanceSlot', id: 't2', subscriptionId: null, billing: 'fara_abonament' }, { op: 'setAttendanceSlot', id: 't1', subscriptionId: null, billing: 'fara_abonament' }] }))
      .toEqual({ athletes: ['a9'], lessons: [], attendances: ['t1', 't2', 't3'], subscriptions: [], payments: [] });
  });
  it('an A.C.S. stamp follows the state, and no row has none', () => {
    expect(acsStamp('a1', 's26', 'da')).not.toBe(acsStamp('a1', 's26', 'nu'));
    expect(acsStamp('a1', 's26', 'da')).not.toBe(acsStamp('a1', 's25', 'da'));
    expect(acsStamp('a1', 's26', null)).toBeNull();
  });
  it('reads only presence records', () => {
    expect(readPresenceRecord({ kind: 'group', steps: [], subjects: [] })).toBeNull();
    expect(readPresenceRecord({ kind: 'presence', steps: [], subjects: [], athletes: [], guards: [] })?.kind).toBe('presence');
  });
});
