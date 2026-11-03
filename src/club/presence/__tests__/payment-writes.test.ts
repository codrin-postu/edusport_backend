import { describe, expect, it } from 'vitest';
import type { AdminResult } from '../../admin-result';
import { historyTexts } from '../../history-text';
import { cancelPayment } from '../payments/cancel';
import { editPayment } from '../payments/edit';
import { recordPayment } from '../payments/record';
import { undoPresenceAction } from '../undo-service';
import { athleteRow, fakePresenceContext, lessonRow, paymentRow, subscriptionRow, type FakePresenceContext, type FakePresenceSeed } from './fake-store';

const acsRow = (athleteId: string, seasonId: string, state: 'da' | 'nu' | 'in_asteptare') => ({ id: `acs-${athleteId}-${seasonId}`, athleteId, seasonId, state });

function seed(over: FakePresenceSeed = {}): FakePresenceSeed {
  return {
    group: {
      athletes: [
        athleteRow({ id: 'a1', name: 'Ana Ionescu', email: 'ana@example.com' }),
        athleteRow({ id: 'a2', name: 'Mihai Pop' }),
        athleteRow({ id: 'a9', name: 'Sportiv anonimizat', status: 'anonimizat' }),
      ],
      admins: { 'admin@example.com': 'Admin Test' },
    },
    subscriptions: [subscriptionRow({ id: 'sub1', athleteId: 'a1' }), subscriptionRow({ id: 'sub-off', athleteId: 'a1', cancelled: true })],
    lessons: [lessonRow({ id: 'l-absent', athleteId: 'a1', state: 'saved', present: false })],
    ...over,
  };
}

const pay = (over: object = {}) => ({ athleteId: 'a1', amount: 320, paidOn: '2026-11-20', method: 'numerar', for: { kind: 'altceva' }, collectedAtRink: false, note: '', sendEmail: false, ...over });
const editBody = (over: object = {}) => ({ amount: 300, paidOn: '2026-10-27', method: 'numerar', for: { kind: 'altceva' }, collectedAtRink: false, note: '', ...over });

function valueOf<T>(r: AdminResult<{ value: T; actionId: string | null }>): T {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r)}`);
  return r.data.value;
}
function actionIdOf(r: AdminResult<{ value: unknown; actionId: string | null }>): string {
  if (!r.ok || r.data.actionId === null) throw new Error(`expected an action id, got ${JSON.stringify(r)}`);
  return r.data.actionId;
}
const historyTextsOf = (f: FakePresenceContext, type: string, id: string): string[] =>
  f.group.history.filter((h) => h.subjectType === type && h.subjectId === id).flatMap((h) => historyTexts(h.action, h.changes, h.subjectType));
const acsOf = async (f: FakePresenceContext, seasonId = 's26') => (await f.store.acsRows({ athleteId: 'a1', seasonId })).map((r) => r.state);

describe('record a payment', () => {
  it('records a payment with lines and an undo (4.15, 8)', async () => {
    const f = fakePresenceContext(seed());
    const res = await recordPayment(f.ctx, pay());
    expect(res).toMatchObject({ ok: true, data: { value: { amount: 320, athleteName: 'Ana Ionescu' } } });
    expect(f.state.payments).toHaveLength(1);
    expect(f.state.payments[0]).toMatchObject({ purpose: 'altceva', seasonId: 's26', recordedBy: 'Admin Test', sendEmail: false, emailJobId: null, cancelled: false });
    expect(historyTextsOf(f, 'athlete', 'a1')).toEqual(['Plată înregistrată: 320 RON, Numerar, Altceva.']);
    expect(f.state.jobs).toEqual([]);
    expect(f.emailsAfter).toEqual([]);
  });

  it('a fee sets A.C.S. Da; its undo deletes the payment and the A.C.S. row (4.16, 7.3)', async () => {
    const f = fakePresenceContext(seed());
    const res = await recordPayment(f.ctx, pay({ amount: 100, for: { kind: 'cotizatie', seasonId: 's26' } }));
    expect(await acsOf(f)).toEqual(['da']);
    expect(f.state.payments[0].acsBefore).toBeNull();
    expect(historyTextsOf(f, 'athlete', 'a1')).toContain('Membru A.C.S. 2026-2027: Nu → Da');
    await undoPresenceAction(f.ctx, { actionId: actionIdOf(res) });
    expect(f.state.payments).toEqual([]);
    expect(await f.store.acsRows({ athleteId: 'a1', seasonId: 's26' })).toEqual([]);
  });

  it('the undo of a fee is refused once A.C.S. changed after it (carry: acs guard)', async () => {
    const f = fakePresenceContext(seed());
    const res = await recordPayment(f.ctx, pay({ amount: 100, for: { kind: 'cotizatie', seasonId: 's26' } }));
    await f.store.setAcs('a1', 's26', 'nu');
    expect(await undoPresenceAction(f.ctx, { actionId: actionIdOf(res) })).toEqual({ ok: false, status: 409, error: 'Nu se mai poate anula. Datele s-au schimbat între timp.' });
    expect(f.state.payments).toHaveLength(1);
  });

  it('a fee over A.C.S. already Da changes nothing and keeps acsBefore da', async () => {
    const f = fakePresenceContext(seed({ acs: [acsRow('a1', 's26', 'da')] }));
    await recordPayment(f.ctx, pay({ amount: 100, for: { kind: 'cotizatie', seasonId: 's26' } }));
    expect(f.state.payments[0].acsBefore).toBe('da');
    expect(historyTextsOf(f, 'athlete', 'a1')).toEqual(['Plată înregistrată: 100 RON, Numerar, Cotizație membru 2026-2027.']);
  });

  it('the ticked e-mail is queued 15 s and attempted after commit; never without the tick (4.19, 2.3)', async () => {
    const f = fakePresenceContext(seed());
    await recordPayment(f.ctx, pay({ sendEmail: true }));
    expect(f.state.jobs).toMatchObject([{ recipient: 'ana@example.com', status: 'queued', payload: { athleteName: 'Ana Ionescu', amount: 320, purposeText: 'Altceva' } }]);
    expect(f.state.jobs[0].notBefore).toBe('2026-11-20T10:00:15.000Z');
    expect(f.state.payments[0].emailJobId).toBe(f.state.jobs[0].id);
    expect(f.emailsAfter).toEqual([f.state.payments[0].id]);
    expect((await recordPayment(f.ctx, pay({ athleteId: 'a2', sendEmail: true }))).ok).toBe(false);
  });

  it('undoing a record with an e-mail cancels the queued job', async () => {
    const f = fakePresenceContext(seed());
    const res = await recordPayment(f.ctx, pay({ sendEmail: true }));
    await undoPresenceAction(f.ctx, { actionId: actionIdOf(res) });
    expect(f.state.payments).toEqual([]);
    expect(f.state.jobs[0].status).toBe('cancelled');
  });

  it('a second identical payment within 10 s is not written (decided 1)', async () => {
    const f = fakePresenceContext(seed());
    const first = await recordPayment(f.ctx, pay({ sendEmail: true }));
    const second = await recordPayment(f.ctx, pay({ sendEmail: true }));
    expect(f.state.payments).toHaveLength(1);
    expect(f.state.jobs).toHaveLength(1);
    expect(f.emailsAfter).toHaveLength(1);
    expect(second).toMatchObject({ ok: true, data: { actionId: null, value: { paymentId: valueOf(first).paymentId } } });
    f.advance(11_000);
    await recordPayment(f.ctx, pay());
    expect(f.state.payments).toHaveLength(2);
  });

  it('refuses a cancelled abonament, a lesson not held, an anonymized athlete, a future date (8 decided)', async () => {
    const f = fakePresenceContext(seed());
    expect(await recordPayment(f.ctx, pay({ for: { kind: 'abonament', subscriptionId: 'sub-off' } }))).toEqual({ ok: false, status: 409, error: 'Datele s-au schimbat. Reîncarcă pagina.' });
    expect((await recordPayment(f.ctx, pay({ for: { kind: 'lectie', lessonId: 'l-absent' } }))).ok).toBe(false);
    expect((await recordPayment(f.ctx, pay({ athleteId: 'a9' }))).ok).toBe(false);
    expect(await recordPayment(f.ctx, pay({ paidOn: '2026-11-21' }))).toEqual({ ok: false, status: 400, error: 'Data nu poate fi în viitor.' });
    expect(f.state.payments).toEqual([]);
  });

  it('refuses a link of another athlete and an unknown fee season', async () => {
    const f = fakePresenceContext(seed());
    expect((await recordPayment(f.ctx, pay({ athleteId: 'a2', for: { kind: 'abonament', subscriptionId: 'sub1' } }))).ok).toBe(false);
    expect(await recordPayment(f.ctx, pay({ for: { kind: 'cotizatie', seasonId: 'nope' } }))).toEqual({ ok: false, status: 400, error: 'Cerere invalidă.' });
    expect(f.state.payments).toEqual([]);
  });

  it('locks athlete, then the abonament, then nothing else (7.1)', async () => {
    const f = fakePresenceContext(seed());
    await recordPayment(f.ctx, pay({ for: { kind: 'abonament', subscriptionId: 'sub1' }, collectedAtRink: true }));
    expect(f.group.locks).toEqual(['athlete:a1', 'subscription:sub1']);
    expect(f.state.payments[0]).toMatchObject({ purpose: 'abonament', subscriptionId: 'sub1', collectedAtRink: true });
  });

  it('one failing write rolls everything back (7.2)', async () => {
    const f = fakePresenceContext(seed());
    f.failOn('createPaymentEmailJob');
    expect(await recordPayment(f.ctx, pay({ sendEmail: true }))).toEqual({ ok: false, status: 500, error: 'Acțiunea nu a reușit. Nimic nu a fost salvat.' });
    expect(f.state.payments).toEqual([]);
    expect(f.emailsAfter).toEqual([]);
  });
});

describe('edit a payment', () => {
  it('field lines old -> new, nothing changed answers changed false (4.17)', async () => {
    const owing = lessonRow({ id: 'l-oct', athleteId: 'a1', date: '2026-10-28', state: 'saved', present: true, price: 400, amount: 400 });
    const f = fakePresenceContext(seed({ payments: [paymentRow({ id: 'p1', athleteId: 'a1', amount: 300 })], lessons: [owing] }));
    expect(await editPayment(f.ctx, 'p1', editBody())).toEqual({ ok: true, data: { value: { changed: false }, actionId: null } });
    expect(f.group.history).toEqual([]);
    await editPayment(f.ctx, 'p1', editBody({ amount: 320, for: { kind: 'club_luna', month: '2026-10' }, collectedAtRink: true }));
    expect(f.state.payments[0]).toMatchObject({ amount: 320, purpose: 'club_luna', clubMonth: '2026-10', collectedAtRink: false });
    expect(historyTextsOf(f, 'payment', 'p1')).toEqual(['Sumă: "300 RON" → "320 RON"', 'Pentru: "Altceva" → "Club, octombrie"']);
  });

  it('its undo puts the old values back (7.3)', async () => {
    const f = fakePresenceContext(seed({ payments: [paymentRow({ id: 'p1', athleteId: 'a1', amount: 300 })] }));
    const res = await editPayment(f.ctx, 'p1', editBody({ amount: 320 }));
    await undoPresenceAction(f.ctx, { actionId: actionIdOf(res) });
    expect(f.state.payments[0].amount).toBe(300);
  });

  it('re-purposing a fee reverts A.C.S. only when no other fee of the season remains (C9)', async () => {
    const f = fakePresenceContext(seed({ acs: [acsRow('a1', 's26', 'da')], payments: [paymentRow({ id: 'f1', athleteId: 'a1', purpose: 'cotizatie', seasonId: 's26', acsBefore: 'nu', amount: 100 })] }));
    const res = await editPayment(f.ctx, 'f1', editBody({ amount: 100 }));
    expect(await acsOf(f)).toEqual(['nu']);
    expect(f.state.payments[0].acsBefore).toBeNull();
    expect(historyTextsOf(f, 'athlete', 'a1')).toEqual(['Membru A.C.S. 2026-2027: Da → Nu']);
    await undoPresenceAction(f.ctx, { actionId: actionIdOf(res) });
    expect(await acsOf(f)).toEqual(['da']);
    expect(f.state.payments[0]).toMatchObject({ purpose: 'cotizatie', acsBefore: 'nu' });
  });

  it('re-purposing into a fee sets A.C.S. Da', async () => {
    const f = fakePresenceContext(seed({ payments: [paymentRow({ id: 'p1', athleteId: 'a1', amount: 100 })] }));
    await editPayment(f.ctx, 'p1', editBody({ amount: 100, for: { kind: 'cotizatie', seasonId: 's26' } }));
    expect(await acsOf(f)).toEqual(['da']);
    expect(f.state.payments[0]).toMatchObject({ purpose: 'cotizatie', acsBefore: null });
  });

  it('a cancelled payment is not edited', async () => {
    const f = fakePresenceContext(seed({ payments: [paymentRow({ id: 'p1', athleteId: 'a1', cancelled: true })] }));
    expect(await editPayment(f.ctx, 'p1', editBody())).toEqual({ ok: false, status: 409, error: 'Datele s-au schimbat. Reîncarcă pagina.' });
  });

  it('moving a payment between two abonamente with the same item name writes a Pentru line with the start dates (final review M1)', async () => {
    const subs = [subscriptionRow({ id: 'sub1', athleteId: 'a1', startsOn: '2026-10-27' }), subscriptionRow({ id: 'sub2', athleteId: 'a1', startsOn: '2026-11-03' })];
    const f = fakePresenceContext(seed({ subscriptions: subs, payments: [paymentRow({ id: 'p1', athleteId: 'a1', amount: 300, purpose: 'abonament', subscriptionId: 'sub1' })] }));
    await editPayment(f.ctx, 'p1', editBody({ amount: 300, for: { kind: 'abonament', subscriptionId: 'sub2' } }));
    expect(historyTextsOf(f, 'payment', 'p1')).toEqual(['Pentru: "Abonament 8 ședințe (activ din 27 oct)" → "Abonament 8 ședințe (activ din 3 noi)"']);
  });

  it('a move between two abonamente with the same name and start date still writes a non-empty line (final review M1)', async () => {
    const subs = [subscriptionRow({ id: 'sub1', athleteId: 'a1' }), subscriptionRow({ id: 'sub2', athleteId: 'a1' })];
    const f = fakePresenceContext(seed({ subscriptions: subs, payments: [paymentRow({ id: 'p1', athleteId: 'a1', amount: 300, purpose: 'abonament', subscriptionId: 'sub1' })] }));
    await editPayment(f.ctx, 'p1', editBody({ amount: 300, for: { kind: 'abonament', subscriptionId: 'sub2' } }));
    expect(historyTextsOf(f, 'payment', 'p1')).toHaveLength(1);
    expect(f.state.payments[0].subscriptionId).toBe('sub2');
  });

  it('locks athlete, the new abonament, then the payment (7.1)', async () => {
    const f = fakePresenceContext(seed({ payments: [paymentRow({ id: 'p1', athleteId: 'a1' })] }));
    await editPayment(f.ctx, 'p1', editBody({ for: { kind: 'abonament', subscriptionId: 'sub1' } }));
    expect(f.group.locks).toEqual(['athlete:a1', 'subscription:sub1', 'payment:p1']);
  });
});

describe('cancel a payment', () => {
  it('row kept struck, queued e-mail cancelled, A.C.S. reverted; undo un-cancels; second cancel refused (4.17, decided 7)', async () => {
    const f = fakePresenceContext(seed());
    await recordPayment(f.ctx, pay({ amount: 100, for: { kind: 'cotizatie', seasonId: 's26' }, sendEmail: true }));
    const id = f.state.payments[0].id;
    const res = await cancelPayment(f.ctx, id);
    expect(f.state.payments[0]).toMatchObject({ cancelled: true, cancelledBy: 'Admin Test' });
    expect(f.state.jobs[0].status).toBe('cancelled');
    expect(await f.store.acsRows({ athleteId: 'a1', seasonId: 's26' })).toEqual([]);
    expect(historyTextsOf(f, 'athlete', 'a1')).toContain('Plată anulată: 100 RON, 20 noi 2026.');
    expect((await cancelPayment(f.ctx, id)).ok).toBe(false);
    await undoPresenceAction(f.ctx, { actionId: actionIdOf(res) });
    expect(f.state.payments[0]).toMatchObject({ cancelled: false, cancelledAt: null, cancelledBy: null });
    expect(await acsOf(f)).toEqual(['da']);
  });

  it.each([['f1', 'f2'], ['f2', 'f1']])('cancelling both fees of a season, %s first, puts A.C.S. back to the state before the first fee (final review M4)', async (one, two) => {
    const f = fakePresenceContext(seed({ acs: [acsRow('a1', 's26', 'da')], payments: [
      paymentRow({ id: 'f1', athleteId: 'a1', purpose: 'cotizatie', seasonId: 's26', acsBefore: 'nu', recordedAt: '2026-10-01T10:00:00.000Z' }),
      paymentRow({ id: 'f2', athleteId: 'a1', purpose: 'cotizatie', seasonId: 's26', acsBefore: 'da', recordedAt: '2026-10-02T10:00:00.000Z' })] }));
    await cancelPayment(f.ctx, one);
    expect(await acsOf(f)).toEqual(['da']);
    await cancelPayment(f.ctx, two);
    expect(await acsOf(f)).toEqual(['nu']);
  });

  it('cancelling one fee while another fee of the season remains leaves A.C.S. Da (Review Focus)', async () => {
    const f = fakePresenceContext(seed({ acs: [acsRow('a1', 's26', 'da')], payments: [
      paymentRow({ id: 'f1', athleteId: 'a1', purpose: 'cotizatie', seasonId: 's26', acsBefore: 'nu' }), paymentRow({ id: 'f2', athleteId: 'a1', purpose: 'cotizatie', seasonId: 's26', acsBefore: 'da' })] }));
    await cancelPayment(f.ctx, 'f1');
    expect(await acsOf(f)).toEqual(['da']);
  });

  it('a missing payment is not found', async () => {
    const f = fakePresenceContext(seed());
    expect(await cancelPayment(f.ctx, 'nope')).toEqual({ ok: false, status: 404, error: 'Nu a fost găsit.' });
  });
});

describe('the athlete is read again after the lock (final review M3)', () => {
  const merged = (f: FakePresenceContext) => ({
    ...f.ctx,
    store: { ...f.ctx.store, lockPayment: async (id: string) => { await f.ctx.store.lockPayment(id); f.state.payments[0].athleteId = 'a2'; } },
  });
  it('edit and cancel refuse 409 when the payment moved to another athlete meanwhile', async () => {
    const fresh = () => fakePresenceContext(seed({ payments: [paymentRow({ id: 'p1', athleteId: 'a1', amount: 300 })] }));
    const stale = { ok: false, status: 409, error: 'Datele s-au schimbat. Reîncarcă pagina.' };
    const [e, c] = [fresh(), fresh()];
    expect(await editPayment(merged(e), 'p1', editBody({ amount: 100 }))).toEqual(stale);
    expect(await cancelPayment(merged(c), 'p1')).toEqual(stale);
    expect([e.state.payments[0].amount, c.state.payments[0].cancelled]).toEqual([300, false]);
  });
});

describe('no payment above what is owed (DEC 2026-11-03)', () => {
  const forSub = { kind: 'abonament', subscriptionId: 'sub1' };
  const TEXT = (n: string) => ({ ok: false, status: 400, error: `Suma depășește restul de plată: ${n} RON.` });

  it('the second of two payments that together exceed the price is refused; exactly the rest is accepted', async () => {
    const f = fakePresenceContext(seed());
    expect((await recordPayment(f.ctx, pay({ amount: 200, for: forSub }))).ok).toBe(true);
    expect(await recordPayment(f.ctx, pay({ amount: 120.01, for: forSub }))).toEqual(TEXT('120'));
    expect(f.state.payments).toHaveLength(1);
    expect((await recordPayment(f.ctx, pay({ amount: 120, for: forSub }))).ok).toBe(true);
    expect(f.state.payments).toHaveLength(2);
  });

  it('the check adds no lock: athlete, then abonament, even when it refuses (7.1)', async () => {
    const f = fakePresenceContext(seed());
    expect((await recordPayment(f.ctx, pay({ amount: 320.01, for: forSub }))).ok).toBe(false);
    expect(f.group.locks).toEqual(['athlete:a1', 'subscription:sub1']);
  });

  it('an identical double click still answers as a duplicate, not as a refusal', async () => {
    const f = fakePresenceContext(seed());
    await recordPayment(f.ctx, pay({ amount: 320, for: forSub }));
    expect(await recordPayment(f.ctx, pay({ amount: 320, for: forSub }))).toMatchObject({ ok: true });
    expect(f.state.payments).toHaveLength(1);
  });

  it('Altceva has no limit', async () => {
    const f = fakePresenceContext(seed());
    expect((await recordPayment(f.ctx, pay({ amount: 99999 }))).ok).toBe(true);
  });

  it('an edit counts its own amount as owed, and a changed Pentru uses the new target', async () => {
    const f = fakePresenceContext(seed({ payments: [paymentRow({ id: 'p1', athleteId: 'a1', amount: 300, purpose: 'abonament', subscriptionId: 'sub1' })] }));
    expect((await editPayment(f.ctx, 'p1', editBody({ amount: 320, for: forSub }))).ok).toBe(true);
    expect(await editPayment(f.ctx, 'p1', editBody({ amount: 320.01, for: forSub }))).toEqual(TEXT('320'));
    expect(f.state.payments[0].amount).toBe(320);
    f.state.subscriptions.push(subscriptionRow({ id: 'sub2', athleteId: 'a1', price: 100 }));
    expect(await editPayment(f.ctx, 'p1', editBody({ amount: 320, for: { kind: 'abonament', subscriptionId: 'sub2' } }))).toEqual(TEXT('100'));
  });

  it('a payment already over (older data) stays editable when the amount does not grow', async () => {
    const f = fakePresenceContext(seed({ payments: [paymentRow({ id: 'p1', athleteId: 'a1', amount: 500, purpose: 'abonament', subscriptionId: 'sub1' })] }));
    expect((await editPayment(f.ctx, 'p1', editBody({ amount: 500, note: 'x', for: forSub }))).ok).toBe(true);
  });

  it('the undo of a cancel is refused when the restored payment would exceed the price', async () => {
    const f = fakePresenceContext(seed());
    await recordPayment(f.ctx, pay({ amount: 320, for: forSub }));
    const cancelled = await cancelPayment(f.ctx, f.state.payments[0].id);
    await recordPayment(f.ctx, pay({ amount: 100, for: forSub, method: 'card' }));
    expect(await undoPresenceAction(f.ctx, { actionId: actionIdOf(cancelled) })).toEqual(TEXT('220'));
    expect(f.state.payments[0].cancelled).toBe(true);
  });
});
