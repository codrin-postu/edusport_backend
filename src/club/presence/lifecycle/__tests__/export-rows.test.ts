import { describe, expect, it } from 'vitest';
import { athleteRow, attendanceRow, fakePresenceStore, lessonRow, paymentRow, sessionRow, subscriptionRow } from '../../__tests__/fake-store';
import { attendanceLine, lessonLine, paymentLine, subscriptionLine } from '../../copy/lifecycle';
import type { PaymentRow } from '../../types';
import { loadPresenceExportFacts, paymentPurposeText, presenceSummary, type PresenceExportFacts } from '../export-rows';

const sharedSessionStore = () => fakePresenceStore({
  sessions: [sessionRow({ id: 's1', date: '2026-11-07' })],
  attendances: [
    attendanceRow({ id: 't1', sessionId: 's1', athleteId: 'a1', uniqueKey: 's1|a1', subscriptionId: 'sub1' }),
    attendanceRow({ id: 't2', sessionId: 's1', athleteId: 'a2', uniqueKey: 's1|a2' }),
  ],
  lessons: [lessonRow({ id: 'l1', athleteId: 'a1' }), lessonRow({ id: 'l2', athleteId: 'a2' })],
  subscriptions: [subscriptionRow({ id: 'sub1', athleteId: 'a1' }), subscriptionRow({ id: 'sub2', athleteId: 'a2' })],
  payments: [paymentRow({ id: 'p1', athleteId: 'a1' }), paymentRow({ id: 'p2', athleteId: 'a2' })],
  group: { athletes: [athleteRow({ id: 'a1', name: 'Ilinca Zamfirescu' }), athleteRow({ id: 'a2', name: 'Mihai Pop' })] },
}).store;

const facts = (): PresenceExportFacts => ({
  attendances: [
    attendanceRow({ id: 't1', sessionId: 's1', subscriptionId: 'sub1' }), attendanceRow({ id: 't2', sessionId: 's2', uniqueKey: 's2|a1', subscriptionId: 'sub1' }),
  ].map((a) => ({ ...a, sessionDate: '', groupId: 'g-ib' })),
  sessions: [sessionRow({ id: 's1', date: '2026-11-07' }), sessionRow({ id: 's2', date: '2026-11-08' })],
  lessons: [], subscriptions: [subscriptionRow({ id: 'sub1' })], used: new Map([['sub1', 2]]),
  payments: [paymentRow({ id: 'p1', paidOn: '2026-10-27' }), paymentRow({ id: 'p2', paidOn: '2026-10-26', cancelled: true })],
  groups: [{ id: 'g-ib', name: 'Intermediari Bronze' }], coaches: [], seasons: [{ id: 's26', label: '2026-2027' }],
});

describe('export rows (4.21a)', () => {
  it('row formats of spec 4.21a', () => {
    expect(attendanceLine({ date: '2026-10-27', groupName: 'Intermediari Bronze', startTime: '17:00', grup: true, uscat: false, visitor: false })).toBe('27 oct 2026, Intermediari Bronze, 17:00, Grup');
    expect(attendanceLine({ date: '2026-10-27', groupName: 'Avansați', startTime: '18:00', grup: true, uscat: true, visitor: false })).toBe('27 oct 2026, Avansați, 18:00, Grup, Uscat');
    expect(attendanceLine({ date: '2026-10-27', groupName: 'Avansați', startTime: '18:00', grup: false, uscat: true, visitor: true })).toBe('27 oct 2026, Avansați, 18:00, Uscat, doar la ședința asta');
    expect(lessonLine({ date: '2026-10-28', startTime: '18:00', durationMin: 50, coachNames: ['Virgil Pascu'], present: true, price: 80 })).toBe('28 oct 2026, 18:00, 50 min, antrenor Virgil Pascu, prezent, 80 RON');
    expect(lessonLine({ date: '2026-10-28', startTime: '18:00', durationMin: 50, coachNames: ['Virgil Pascu'], present: false, price: 80 })).toBe('28 oct 2026, 18:00, 50 min, antrenor Virgil Pascu, absent');
    expect(lessonLine({ date: '2026-10-28', startTime: '18:00', durationMin: 60, coachNames: ['Virgil Pascu', 'Andreea Pascu'], present: null, price: null })).toBe('28 oct 2026, 18:00, 60 min, antrenori Virgil Pascu și Andreea Pascu');
    expect(subscriptionLine({ itemName: 'Abonament 8 ședințe', startsOn: '2026-10-27', validUntil: '2026-11-23', used: 5, slots: 8, state: 'activ', price: 320 })).toBe('Abonament 8 ședințe, din 27 oct 2026, expiră pe 23 noi 2026, 5/8, activ, 320 RON');
    expect(paymentLine({ paidOn: '2026-10-27', amount: 320, method: 'numerar', purposeText: 'Abonament 8 ședințe', collectedAtRink: true, note: null, cancelled: false })).toBe('27 oct 2026, 320 RON, Numerar, Abonament 8 ședințe, la patinoar');
    expect(paymentLine({ paidOn: '2026-10-27', amount: 12.5, method: 'card', purposeText: 'Altceva', collectedAtRink: false, note: 'taxă concurs', cancelled: true })).toBe('27 oct 2026, 12,50 RON, Card (POS), Altceva, Notă: taxă concurs, anulată');
  });

  it('"Pentru" text per purpose (decided 11)', () => {
    const f = { subscriptions: [subscriptionRow({ id: 'sub1', itemName: 'Abonament 8 ședințe' })], seasons: [{ id: 's26', label: '2026-2027' }] };
    const p = (over: Partial<PaymentRow>) => paymentPurposeText(paymentRow(over), f);
    expect([p({ purpose: 'abonament', subscriptionId: 'sub1' }), p({ purpose: 'cotizatie', seasonId: 's26' }), p({ purpose: 'club_luna', clubMonth: '2026-10' }), p({ purpose: 'lectie' }), p({ purpose: 'altceva' })])
      .toEqual(['Abonament 8 ședințe', 'Cotizație membru 2026-2027', 'Club, octombrie 2026', 'Lecție individuală', 'Altceva']);
  });

  it('loads only this child\'s rows and never names another child (4.21a, DEC 2026-10-27 3C 1)', async () => {
    const f = await loadPresenceExportFacts(sharedSessionStore(), 'a1');
    expect(f.attendances.map((a) => a.athleteId)).toEqual(['a1']);
    expect([f.lessons, f.payments, f.subscriptions].flat().every((r) => r.athleteId === 'a1')).toBe(true);
    expect(JSON.stringify(presenceSummary(f, '2026-11-20'))).not.toContain('Mihai');
  });

  it('newest first; cancelled payments kept and marked; used slots and state from today (4.21a)', () => {
    const s = presenceSummary(facts(), '2026-11-20');
    expect(s.attendance).toEqual(['8 noi 2026, Intermediari Bronze, 11:00, Grup', '7 noi 2026, Intermediari Bronze, 11:00, Grup']);
    expect(s.subscriptions).toEqual(['Abonament 8 ședințe, din 27 oct 2026, expiră pe 23 noi 2026, 2/8, activ, 320 RON']);
    expect(s.payments.at(-1)).toMatch(/, anulată$/);
  });
});
