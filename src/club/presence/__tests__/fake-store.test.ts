import { describe, expect, it } from 'vitest';
import { UniqueKeyError } from '../store';
import type { PaymentEmailJob } from '../types';
import { athleteRow, attendanceRow, fakePresenceStore, lessonRow, paymentRow, sessionRow } from './fake-store';

const job = (over: Partial<PaymentEmailJob> = {}): PaymentEmailJob => ({
  recipient: 'p@example.com', subject: 'Plată', paymentId: 'p1', notBefore: '2026-11-20T10:00:00.000Z',
  payload: { athleteName: 'Ana', amount: 320, method: 'numerar', paidOn: '2026-10-27', purposeText: 'Abonament' }, ...over,
});

describe('fake presence store', () => {
  it('rolls back presence and group state together', async () => {
    const { store, state, group, failOn } = fakePresenceStore({ group: { athletes: [athleteRow({ id: 'a1' })] } });
    failOn('record');
    await expect(store.transaction(async () => {
      await store.createPayment(paymentRow({ athleteId: 'a1' }), '2026-0001');
      await store.setAthleteStatus('a1', 'inactiv');
      await store.record({ subjectType: 'payment', subjectId: 'p', action: 'payment-recorded', actor: 'x' });
    })).rejects.toThrow('fake failure in record');
    expect(state.payments).toEqual([]);
    expect(group.athletes[0].status).not.toBe('inactiv');
  });
  it('createSession refuses a second occurrence key; createAttendance a second unique key', async () => {
    const { store } = fakePresenceStore();
    await store.createSession(sessionRow({ occurrenceKey: 'ev1|2026-11-07|11:00' }));
    await expect(store.createSession(sessionRow({ occurrenceKey: 'ev1|2026-11-07|11:00' }))).rejects.toBeInstanceOf(UniqueKeyError);
    await store.createSession(sessionRow({ occurrenceKey: null }));
    await store.createSession(sessionRow({ occurrenceKey: null }));
    await store.createAttendance(attendanceRow({ uniqueKey: 's1|a1' }));
    await expect(store.createAttendance(attendanceRow({ uniqueKey: 's1|a1' }))).rejects.toBeInstanceOf(UniqueKeyError);
  });
  it('attendance rows carry their session date and group; filters by session date and subscription', async () => {
    const { store } = fakePresenceStore({ sessions: [sessionRow({ id: 's1', groupId: 'g-ib', date: '2026-11-07' }), sessionRow({ id: 's2', groupId: 'g-ib', date: '2026-12-05' })],
      attendances: [attendanceRow({ id: 't1', sessionId: 's1', subscriptionId: 'sub1' }), attendanceRow({ id: 't2', sessionId: 's2' })] });
    expect((await store.attendances({ from: '2026-11-01', to: '2026-11-30' })).map((a) => [a.id, a.sessionDate, a.groupId])).toEqual([['t1', '2026-11-07', 'g-ib']]);
    expect((await store.attendances({ subscriptionIds: ['sub1'] })).map((a) => a.id)).toEqual(['t1']);
  });
  it('setAcs creates, updates and deletes the one row of an athlete and season', async () => {
    const { store } = fakePresenceStore();
    await store.setAcs('a1', 's26', 'da');
    await store.setAcs('a1', 's26', 'nu');
    expect((await store.acsRows({ athleteId: 'a1' })).map((r) => r.state)).toEqual(['nu']);
    await store.setAcs('a1', 's26', null);
    expect(await store.acsRows({ athleteId: 'a1' })).toEqual([]);
  });
  it('cancels only the queued e-mail of one payment and counts sent ones', async () => {
    const { store, state } = fakePresenceStore();
    await store.createPaymentEmailJob(job({ paymentId: 'p1' }));
    await store.createPaymentEmailJob(job({ paymentId: 'p2' }));
    state.jobs[1].status = 'sent';
    expect(await store.cancelPaymentEmailJob('p1')).toBe(1);
    expect(await store.sentPaymentEmailJobs('p2')).toBe(1);
    expect(state.jobs.map((j) => j.status)).toEqual(['cancelled', 'sent']);
  });
  it('locks only inside a transaction and records their order', async () => {
    const { store, group } = fakePresenceStore();
    await expect(store.lockPayment('p1')).rejects.toThrow('outside a transaction');
    await expect(store.lockAttendance('t1')).rejects.toThrow('outside a transaction');
    await store.transaction(async () => { await store.lockAthlete('a1'); await store.lockAttendance('t1'); await store.lockSubscription('sub1'); await store.lockPayment('p1'); });
    expect(group.locks).toEqual(['athlete:a1', 'attendance:t1', 'subscription:sub1', 'payment:p1']);
  });
  it('writes to a missing row throw', async () => {
    const { store } = fakePresenceStore();
    await expect(store.updatePayment('nope', { amount: 1 })).rejects.toThrow('fake: no payment nope');
  });
  it('fake counters hand out consecutive numbers and never go back', async () => {
    const s = fakePresenceStore().store;
    await expect(s.nextCounter('subscription')).rejects.toThrow('outside a transaction');
    expect(await s.transaction(async () => [await s.nextCounter('subscription'), await s.nextCounter('subscription')])).toEqual([1, 2]);
    await s.transaction(() => s.raiseCounter('subscription', 1));
    expect(await s.counterValue('subscription')).toBe(2);
    await s.transaction(() => s.raiseCounter('receipt:2026', 40));
    expect(await s.transaction(() => s.nextCounter('receipt:2026'))).toBe(41);
    expect(await s.counterValue('missing')).toBe(0);
  });
  it('a rolled back transaction gives its counter number back', async () => {
    const s = fakePresenceStore().store;
    await expect(s.transaction(async () => {
      await s.nextCounter('subscription');
      throw new Error('boom');
    })).rejects.toThrow('boom');
    expect(await s.counterValue('subscription')).toBe(0);
  });
  it('history pages: in range, newest first by date, start time, id desc, limited to take, total unlimited', async () => {
    const s = fakePresenceStore({
      sessions: [
        sessionRow({ id: 's1', date: '2026-11-02', startTime: '17:00' }), sessionRow({ id: 's2', date: '2026-11-02', startTime: '10:00' }),
        sessionRow({ id: 's3', date: '2026-11-05', startTime: '09:00' }), sessionRow({ id: 's4', date: '2026-09-01', startTime: '09:00' }),
      ],
      attendances: ['s1', 's2', 's3', 's4'].map((id) => attendanceRow({ id: `t-${id}`, sessionId: id, athleteId: 'a1', uniqueKey: id })),
      lessons: [
        lessonRow({ id: 'l1', date: '2026-11-05', startTime: '09:00', present: true }), lessonRow({ id: 'l2', date: '2026-11-05', startTime: '09:00', present: true }),
        lessonRow({ id: 'l3', date: '2026-11-06', present: false }),
      ],
    }).store;
    const page = await s.athleteAttendancePage('a1', '2026-10-01', '2027-05-31', 2);
    expect([page.total, page.rows.map((r) => [r.id, r.startTime])]).toEqual([3, [['t-s3', '09:00'], ['t-s1', '17:00']]]);
    const lessons = await s.athleteLessonPage('a1', '2026-10-01', '2027-05-31', 5);
    expect([lessons.total, lessons.rows.map((r) => r.id)]).toEqual([2, ['l2', 'l1']]);
    expect((await s.athleteLessonPage('a2', '2026-10-01', '2027-05-31', 5)).total).toBe(0);
  });
});
