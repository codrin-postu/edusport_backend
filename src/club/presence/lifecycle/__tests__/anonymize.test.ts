import { describe, expect, it, vi } from 'vitest';
import { athleteRow, fakeClubStore } from '../../../athletes/__tests__/fake-store';
import { SUBJECT } from '../../../history-text';
import { anonymizeAthlete, type AnonymizeContext } from '../../../personal-data/anonymize-service';
import { attendanceRow, fakePresenceStore, lessonRow, lessonSeriesRow, paymentRow, sessionRow, subscriptionRow } from '../../__tests__/fake-store';
import { scrubPaymentChanges } from '../anonymize-rows';

const AT = '2026-10-20T10:00:00.000Z';
const job = (id: string, paymentId: string, status: string, recipient: string, name: string) =>
  ({ id, registrationId: null, kind: 'payment' as const, paymentId, recipient, subject: `Plată înregistrată: ${name}`, status, lastError: null, payload: { athleteName: name } });
const line = (seq: number, action: string, changes: Record<string, unknown>) => ({ seq, subjectType: SUBJECT.payment, subjectId: 'p1', action, changes, actor: 'ana@example.com', at: AT });

function setup() {
  const club = fakeClubStore({
    athletes: [athleteRow({ id: 'a1', name: 'Carla Vasilescu', email: 'mama.vasilescu@example.com' }), athleteRow({ id: 'a2', name: 'Mihai Pop' })],
    emailJobs: [
      job('j1', 'p1', 'queued', 'mama.vasilescu@example.com', 'Carla Vasilescu'),
      job('j2', 'p2', 'sent', 'mama.vasilescu@example.com', 'Carla Vasilescu'),
      job('j3', 'p9', 'queued', 'tata.pop@example.com', 'Mihai Pop'),
    ],
    history: [
      line(1, 'payment-email-sent', { recipient: 'mama.vasilescu@example.com' }),
      line(2, 'payment-edited', { fields: { note: { from: null, to: 'Plătit de bunica Vasilescu' }, amount: { from: 300, to: 320 } } }),
    ],
  });
  const pres = fakePresenceStore({
    sessions: [sessionRow({ id: 's1' })],
    attendances: [attendanceRow({ id: 't1', sessionId: 's1', athleteId: 'a1', uniqueKey: 's1|a1' })],
    lessons: [lessonRow({ id: 'l1', athleteId: 'a1', date: '2026-10-05' })],
    subscriptions: [subscriptionRow({ id: 'sub1', athleteId: 'a1' })],
    payments: [
      paymentRow({ id: 'p1', athleteId: 'a1', note: 'Plătit de bunica Vasilescu', subscriptionId: 'sub1', purpose: 'abonament' }),
      paymentRow({ id: 'p2', athleteId: 'a1', cancelled: true, cancelledAt: AT, cancelledBy: 'ana@example.com' }),
      paymentRow({ id: 'p9', athleteId: 'a2', note: 'Pentru Mihai' }),
    ],
  });
  const ctx: AnonymizeContext = {
    store: club.store, actor: 'super@example.com', today: { year: 2026, month: 10, day: 27 }, log: vi.fn(),
    removeFiles: async () => undefined, now: () => new Date('2026-10-27T09:00:00.000Z'), presence: pres.store,
  };
  return { club, pres, ctx };
}

describe('anonymize keeps money rows (4.21, p5 Q30)', () => {
  it('keeps every payment with amount, date, method, season, purpose and links; clears only the note (4.21, p5 Q30)', async () => {
    const f = setup();
    const before = f.pres.state.payments.map(({ note: _note, ...rest }) => rest);
    expect(await anonymizeAthlete(f.ctx, 'a1')).toEqual({ ok: true, data: { documentId: 'a1' } });
    expect(f.pres.state.payments.map(({ note: _note, ...rest }) => rest)).toEqual(before);
    expect(f.pres.state.payments.map((p) => [p.id, p.note])).toEqual([['p1', null], ['p2', null], ['p9', 'Pentru Mihai']]);
  });

  it('keeps attendance, lessons and abonamente as they were', async () => {
    const f = setup();
    const snapshot = structuredClone([f.pres.state.attendances, f.pres.state.lessons, f.pres.state.subscriptions]);
    await anonymizeAthlete(f.ctx, 'a1');
    expect([f.pres.state.attendances, f.pres.state.lessons, f.pres.state.subscriptions]).toEqual(snapshot);
  });

  it('deletes the series and the planned unpaid lessons from today on; saved, paid, past and another child\'s lessons stay', async () => {
    const f = setup();
    f.pres.state.lessonSeries.push(lessonSeriesRow({ id: 'ls1', athleteId: 'a1' }), lessonSeriesRow({ id: 'ls2', athleteId: 'a2' }));
    f.pres.state.lessons.push(
      lessonRow({ id: 'f1', athleteId: 'a1', date: '2026-10-27', seriesId: 'ls1' }), lessonRow({ id: 'f2', athleteId: 'a1', date: '2026-11-03', seriesId: 'ls1' }),
      lessonRow({ id: 'paid', athleteId: 'a1', date: '2026-11-10', seriesId: 'ls1' }), lessonRow({ id: 'done', athleteId: 'a1', date: '2026-11-12', state: 'saved', present: true }),
      lessonRow({ id: 'other', athleteId: 'a2', date: '2026-11-03', seriesId: 'ls2' }),
    );
    f.pres.state.payments.push(paymentRow({ id: 'pl', athleteId: 'a1', purpose: 'lectie', lessonId: 'paid' }));
    expect((await anonymizeAthlete(f.ctx, 'a1')).ok).toBe(true);
    expect(f.pres.state.lessons.map((l) => l.id).sort()).toEqual(['done', 'l1', 'other', 'paid']);
    expect(f.pres.state.lessons.find((l) => l.id === 'paid')?.seriesId).toBeNull();
    expect(f.pres.state.lessonSeries.map((x) => x.id)).toEqual(['ls2']);
    expect(f.pres.group.locks.filter((l) => l.startsWith('lesson'))).toEqual(['lessonSeries:ls1', 'lesson:f1', 'lesson:f2', 'lesson:paid']);
  });

  it('scrubs the child\'s payment e-mails: queued cancelled, sent kept, another child\'s untouched (P3C 4)', async () => {
    const f = setup();
    await anonymizeAthlete(f.ctx, 'a1');
    expect(f.club.state.emailJobs.map((j) => [j.id, j.status, j.recipient, j.subject, j.payload ?? null])).toEqual([
      ['j1', 'cancelled', null, null, null], ['j2', 'sent', null, null, null], ['j3', 'queued', 'tata.pop@example.com', 'Plată înregistrată: Mihai Pop', { athleteName: 'Mihai Pop' }],
    ]);
  });

  it('blanks the address and the note in the payments\' Istoric, keeps the rest (8, decided 7)', async () => {
    const f = setup();
    await anonymizeAthlete(f.ctx, 'a1');
    const lines = f.club.state.history.filter((h) => h.subjectType === 'payment' && h.subjectId === 'p1');
    expect(lines.map((h) => h.changes)).toEqual([{ recipient: null }, { fields: { note: { from: null, to: null }, amount: { from: 300, to: 320 } } }]);
    expect(JSON.stringify(f.club.state)).not.toMatch(/Vasilescu|mama\.vasilescu/);
    expect(JSON.stringify(f.pres.state)).not.toMatch(/Vasilescu/);
  });

  it('locks the athlete, then its payments sorted (7.1)', async () => {
    const f = setup();
    await anonymizeAthlete(f.ctx, 'a1');
    expect(f.club.state.locks.at(-1)).toBe('athlete:a1');
    expect(f.pres.group.locks).toEqual(['payment:p1', 'payment:p2']);
  });

  it('rolls both stores back on a failure', async () => {
    const f = setup();
    f.club.failOn('scrubPaymentEmailJobs');
    expect(await anonymizeAthlete(f.ctx, 'a1')).toEqual({ ok: false, status: 500, error: 'Acțiunea nu a reușit. Nimic nu a fost salvat.' });
    expect(f.pres.state.payments.find((p) => p.id === 'p1')?.note).toBe('Plătit de bunica Vasilescu');
    expect(f.club.state.athletes.find((a) => a.id === 'a1')?.name).toBe('Carla Vasilescu');
  });

  it('scrubPaymentChanges nulls a note pair and the 3C keys, nothing else', () => {
    expect(scrubPaymentChanges({ fields: { note: { from: 'a', to: 'b' }, method: { from: 'numerar', to: 'card' } } }))
      .toEqual({ fields: { note: { from: null, to: null }, method: { from: 'numerar', to: 'card' } } });
    expect(scrubPaymentChanges({ recipient: 'x@example.com', amount: 320 })).toEqual({ recipient: null, amount: 320 });
  });
});
