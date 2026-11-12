import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { registrationRow } from '../../../athletes/__tests__/fake-store';
import { attendanceRow, lessonRow, paymentRow, sessionRow, subscriptionRow } from '../../../presence/__tests__/fake-store';
import type { PaymentRowView } from '../../../presence/money-api';
import { clubMonths } from '../../../presence/due/settlement';
import { forbiddenPathsIn } from '../../forbidden-keys';
import { paymentWhat, readAcord, readMoney, readPayments, readSubscriptions } from '../money';
import { SPORTIV_FORBIDDEN_KEYS } from '../views';
import { A_ANA, A_IOANA, A_MATEI, sportivCtx, type SportivSeed } from './sportiv-seed';

const leaks = (answer: unknown): string[] => forbiddenPathsIn(answer, [...SPORTIV_FORBIDDEN_KEYS, 'paymentId', 'receiptNo', 'athleteId', 'athleteName', 'email', 'phone']);

/** A Club presence of Ioana at 40 RON in Club Performanță. */
function clubPresence(c: SportivSeed, id: string, date: string, over: { billing?: 'club' | 'inclus'; price?: number | null; groupId?: string } = {}): void {
  const price = over.price === undefined ? 40 : over.price;
  c.fake.state.sessions.push(sessionRow({ id: `s-${id}`, groupId: over.groupId ?? 'g-perf', date }));
  c.fake.state.attendances.push(attendanceRow({
    id: `t-${id}`, sessionId: `s-${id}`, athleteId: A_IOANA, uniqueKey: `s-${id}|io`, billing: over.billing ?? 'club',
    charges: [{ type: 'grup', itemName: 'Ședință grup', price, included: over.billing === 'inclus' }], amount: over.billing === 'inclus' ? 0 : (price ?? 0),
  }));
}

describe('readMoney', () => {
  it('a Club month with money left is one line named after the group and the month', async () => {
    const c = sportivCtx('sportiv18@example.invalid');
    for (let i = 0; i < 4; i++) clubPresence(c, `c${i}`, `2026-11-0${i + 2}`);
    c.fake.state.payments.push(paymentRow({ id: 'p1', athleteId: A_IOANA, amount: 10, purpose: 'club_luna', clubMonth: '2026-11' }));
    const m = await readMoney(c, A_IOANA);
    expect(m).toMatchObject({ left: 150, lines: [{ text: 'Club Performanță noiembrie', amount: 150 }], advance: null, abonament: null, document: null });
    expect(leaks(m)).toEqual([]);
  });

  it('an inclus session adds nothing and no line', async () => {
    const c = sportivCtx('sportiv18@example.invalid');
    clubPresence(c, 'i1', '2026-11-03', { billing: 'inclus' });
    expect(await readMoney(c, A_IOANA)).toMatchObject({ left: 0, lines: [], advance: null });
  });

  it('a group without a price list adds nothing', async () => {
    const c = sportivCtx('sportiv18@example.invalid');
    c.fake.group.groups.find((g) => g.id === 'g-perf')!.priceListId = null;
    clubPresence(c, 'n1', '2026-11-03');
    expect(await readMoney(c, A_IOANA)).toMatchObject({ left: 0, lines: [] });
  });

  it('an unpaid Școala abonament and an unpaid lesson are lines', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    c.fake.state.lessons.push(lessonRow({ id: 'l-12', athleteId: A_ANA, date: '2026-11-12', state: 'saved', present: true, price: 100, amount: 100 }));
    const m = await readMoney(c, A_ANA);
    expect(m.lines).toEqual([{ text: 'Lecție 12 noi', amount: 100 }, { text: 'Abonament Școala noiembrie', amount: 320 }]);
    expect(m.left).toBe(420);
    expect(leaks(m)).toEqual([]);
  });

  it('a paid abonament above its price is left 0 and an advance', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    c.fake.state.payments.push(paymentRow({ id: 'p-ab', athleteId: A_ANA, amount: 350, purpose: 'abonament', subscriptionId: 'sub-ana' }));
    expect(await readMoney(c, A_ANA)).toMatchObject({ left: 0, lines: [], advance: 30 });
  });

  const lesson = (c: SportivSeed, amount: number): void => {
    c.fake.state.lessons.push(lessonRow({ id: 'l-12', athleteId: A_IOANA, date: '2026-11-12', state: 'saved', present: true, price: amount, amount }));
  };
  const pay = (c: SportivSeed, id: string, amount: number, over: object): void => {
    c.fake.state.payments.push(paymentRow({ id, athleteId: A_IOANA, amount, ...over }));
  };

  it('pooled with the month: Club due 100 paid 150 and a lesson 50 unpaid is left 0 and no advance', async () => {
    const c = sportivCtx('sportiv18@example.invalid');
    clubPresence(c, 'a1', '2026-11-03', { price: 100 });
    lesson(c, 50);
    pay(c, 'p1', 150, { purpose: 'club_luna', clubMonth: '2026-11' });
    expect(await readMoney(c, A_IOANA)).toMatchObject({ left: 0, lines: [], advance: null });
  });

  it('pooled with the month: Club left 50 and a lesson overpaid by 30 is left 20 and no advance', async () => {
    const c = sportivCtx('sportiv18@example.invalid');
    clubPresence(c, 'b1', '2026-11-03', { price: 50 });
    lesson(c, 20);
    pay(c, 'p1', 50, { purpose: 'lectie', lessonId: 'l-12' });
    pay(c, 'p2', 0.01, { purpose: 'altceva' });
    const m = await readMoney(c, A_IOANA);
    expect(m).toMatchObject({ left: 20, lines: [{ text: 'Club Performanță noiembrie', amount: 20 }], advance: null });
  });

  it('an unpaid lesson is a display line inside its month left, before the Club line', async () => {
    const c = sportivCtx('sportiv18@example.invalid');
    clubPresence(c, 'd1', '2026-11-03', { price: 40 });
    lesson(c, 100);
    expect((await readMoney(c, A_IOANA)).lines).toEqual([{ text: 'Lecție 12 noi', amount: 100 }, { text: 'Club Performanță noiembrie', amount: 40 }]);
  });

  it('left and advance equal the admin month ledger for the same athlete', async () => {
    const c = sportivCtx('sportiv18@example.invalid');
    clubPresence(c, 'e1', '2026-11-03', { price: 100 });
    clubPresence(c, 'e2', '2026-10-05', { price: 40 });
    lesson(c, 50);
    pay(c, 'p1', 150, { purpose: 'club_luna', clubMonth: '2026-11' });
    pay(c, 'p2', 90, { purpose: 'club_luna', clubMonth: '2026-10' });
    const st = c.fake.state;
    const months = clubMonths({
      attendances: await c.presence.store.attendances({ athleteId: A_IOANA }), lessons: st.lessons, payments: st.payments, startDate: st.startDate,
      groupNames: new Map(c.fake.group.groups.map((g) => [g.id, g.name] as const)),
    });
    const m = await readMoney(c, A_IOANA);
    expect(m.left).toBe(months.reduce((n, x) => n + Math.max(0, x.left), 0));
    expect(m.advance).toBe(months.reduce((n, x) => n + Math.max(0, -x.left), 0));
  });

  it('nothing owed is left 0 and no lines', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    expect(await readMoney(c, A_MATEI)).toMatchObject({ left: 0, lines: [], advance: null, abonament: null, document: null });
  });

  it('a Club month overpaid by a correction is Avans and the cancelled payment counts for nothing', async () => {
    const c = sportivCtx('sportiv18@example.invalid');
    clubPresence(c, 'o1', '2026-11-03');
    c.fake.state.payments.push(
      paymentRow({ id: 'p1', athleteId: A_IOANA, amount: 100, purpose: 'club_luna', clubMonth: '2026-11' }),
      paymentRow({ id: 'p2', athleteId: A_IOANA, amount: 500, purpose: 'club_luna', clubMonth: '2026-11', cancelled: true }),
    );
    expect(await readMoney(c, A_IOANA)).toMatchObject({ left: 0, lines: [], advance: 60 });
  });

  it('a fully used Școala abonament shows 8 of 8 with its item and start', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    for (let i = 0; i < 8; i++) {
      c.fake.state.sessions.push(sessionRow({ id: `s-u${i}`, groupId: 'g-ib', date: `2026-11-0${i + 1}` }));
      c.fake.state.attendances.push(attendanceRow({ id: `t-u${i}`, sessionId: `s-u${i}`, athleteId: A_ANA, uniqueKey: `s-u${i}|ana`, billing: 'abonament', subscriptionId: 'sub-ana' }));
    }
    c.fake.state.payments.push(paymentRow({ id: 'p-ab', athleteId: A_ANA, amount: 320, purpose: 'abonament', subscriptionId: 'sub-ana' }));
    const m = await readMoney(c, A_ANA);
    expect(m.abonament).toEqual({ code: null, next: 8, slots: 8, validUntil: '2026-11-28', itemName: 'Abonament 8 ședințe', startsOn: '2026-11-01' });
    expect(m).toMatchObject({ left: 0, advance: null });
    expect((await readSubscriptions(c, A_ANA)).active).toMatchObject({ slots: 8, left: 0 });
  });
});

describe('paymentWhat', () => {
  const view = (f: PaymentRowView['for']): PaymentRowView => ({
    paymentId: 'p', athleteId: 'a', athleteName: 'x', paidOn: '2026-11-01', receiptNo: null, purpose: 'altceva', purposeText: 'x', method: 'numerar',
    collectedAtRink: false, amount: 1, recordedBy: 'x', cancelled: false, for: f, note: 'secret',
  });
  const names = { subscriptionStarts: new Map([['s1', '2026-11-01']]), lessonDates: new Map([['l1', '2026-11-12']]), seasonLabels: new Map([['s26', '2026-2027']]) };
  it('names each purpose', () => {
    expect(paymentWhat(view({ kind: 'abonament', subscriptionId: 's1' }), names)).toBe('Abonament noiembrie');
    expect(paymentWhat(view({ kind: 'lectie', lessonId: 'l1' }), names)).toBe('Lecție 12 noi');
    expect(paymentWhat(view({ kind: 'club_luna', month: '2026-10' }), names)).toBe('Club octombrie');
    expect(paymentWhat(view({ kind: 'cotizatie', seasonId: 's26' }), names)).toBe('Cotizație 2026-2027');
    expect(paymentWhat(view({ kind: 'altceva' }), names)).toBe('Altă plată');
  });
});

describe('readPayments', () => {
  it('lists live payments newest first, 20 a page, with only what, date, method and amount', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    for (let i = 1; i <= 25; i++) {
      c.fake.state.payments.push(paymentRow({
        id: `p${String(i).padStart(2, '0')}`, athleteId: A_ANA, amount: i, paidOn: `2026-10-${String(i).padStart(2, '0')}`, method: i % 2 ? 'card' : 'transfer', note: 'nota interna', receiptNo: 'R1',
      }));
    }
    c.fake.state.payments.push(paymentRow({ id: 'px', athleteId: A_ANA, amount: 999, paidOn: '2026-10-30', cancelled: true }));
    c.fake.state.payments.push(paymentRow({ id: 'pm', athleteId: A_MATEI, amount: 5 }));
    const first = await readPayments(c, A_ANA, 1);
    expect(first).toMatchObject({ page: 1, pageSize: 20, total: 25 });
    expect(first.rows).toHaveLength(20);
    expect(first.rows[0]).toEqual({ what: 'Altă plată', paidOn: '2026-10-25', method: 'card', amount: 25 });
    expect(first.rows.map((r) => r.amount)).not.toContain(999);
    expect((await readPayments(c, A_ANA, 2)).rows.map((r) => r.amount)).toEqual([5, 4, 3, 2, 1]);
    expect(JSON.stringify(first)).not.toMatch(/nota interna|R1|admin@/);
    expect(leaks(first)).toEqual([]);
  });

  it('names an abonament payment after its start month and a lesson payment after its date', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    c.fake.state.lessons.push(lessonRow({ id: 'l-12', athleteId: A_ANA, date: '2026-11-12', state: 'saved', present: true }));
    c.fake.state.payments.push(
      paymentRow({ id: 'p1', athleteId: A_ANA, paidOn: '2026-11-02', purpose: 'abonament', subscriptionId: 'sub-ana', method: 'numerar' }),
      paymentRow({ id: 'p2', athleteId: A_ANA, paidOn: '2026-11-13', purpose: 'lectie', lessonId: 'l-12', method: 'card' }),
    );
    expect((await readPayments(c, A_ANA, 1)).rows.map((r) => r.what)).toEqual(['Lecție 12 noi', 'Abonament noiembrie']);
  });
});

describe('readSubscriptions', () => {
  it('the active ticket carries the dates that used its slots, oldest first; earlier ones are the last 12 months without cancelled', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    for (const [i, date] of ['2026-11-09', '2026-11-03'].entries()) {
      c.fake.state.sessions.push(sessionRow({ id: `s-a${i}`, groupId: 'g-ib', date }));
      c.fake.state.attendances.push(attendanceRow({ id: `t-a${i}`, sessionId: `s-a${i}`, athleteId: A_ANA, uniqueKey: `s-a${i}|ana`, billing: 'abonament', subscriptionId: 'sub-ana' }));
    }
    const old = { athleteId: A_ANA, itemName: 'Abonament 6 ședințe', slots: 6 };
    c.fake.state.subscriptions.push(
      subscriptionRow({ ...old, id: 'sub-ok', startsOn: '2025-12-01', validUntil: '2025-12-28' }),
      subscriptionRow({ ...old, id: 'sub-old', startsOn: '2025-09-01', validUntil: '2025-09-28' }),
      subscriptionRow({ ...old, id: 'sub-can', startsOn: '2026-02-01', validUntil: '2026-02-28', cancelled: true }),
    );
    const s = await readSubscriptions(c, A_ANA);
    expect(s.active).toEqual({ code: null, itemName: 'Abonament 8 ședințe', startsOn: '2026-11-01', validUntil: '2026-11-28', slots: 8, used: ['2026-11-03', '2026-11-09'], left: 6 });
    expect(s.earlier).toEqual([{ itemName: 'Abonament 6 ședințe', used: 0, slots: 6, validUntil: '2025-12-28' }]);
    expect(leaks(s)).toEqual([]);
  });

  it('no abonament is no active ticket', async () => {
    expect(await readSubscriptions(sportivCtx('parinte1@example.invalid'), A_MATEI)).toEqual({ active: null, earlier: [] });
  });
});

describe('readAcord', () => {
  const REG = 'reg1234567890';
  async function withFile(c: SportivSeed, regId: string, name: string): Promise<void> {
    const dir = path.join(c.documentsRoot, 'registrations', regId);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), Buffer.from('%PDF-1.4'));
  }

  it('returns the current-season registration acord file', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    c.clubFake.state.registrations.push(registrationRow({ id: REG, athleteId: A_ANA, seasonId: 's26' }));
    await withFile(c, REG, 'Ana_Acord_2026-2027.pdf');
    await withFile(c, REG, 'Ana_Adeziune_2026-2027.pdf');
    const r = await readAcord(c, A_ANA);
    expect(r).toMatchObject({ ok: true, data: { fileName: 'Ana_Acord_2026-2027.pdf' } });
    expect(r.ok && r.data.data.toString()).toBe('%PDF-1.4');
    expect(await readMoney(c, A_ANA)).toMatchObject({ document: { seasonLabel: '2026-2027' } });
  });

  it('none is 404, an older season file is never returned, nor another athlete file', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    expect(await readAcord(c, A_ANA)).toEqual({ ok: false, status: 404, error: 'Nu a fost găsit.' });
    c.clubFake.state.registrations.push(
      registrationRow({ id: 'regold12345', athleteId: A_ANA, seasonId: 's25' }),
      registrationRow({ id: 'regother1234', athleteId: A_MATEI, seasonId: 's26' }),
    );
    await withFile(c, 'regold12345', 'Ana_Acord_2025-2026.pdf');
    await withFile(c, 'regother1234', 'Matei_Acord_2026-2027.pdf');
    expect(await readAcord(c, A_ANA)).toMatchObject({ ok: false, status: 404 });
    expect((await readMoney(c, A_ANA)).document).toBeNull();
  });
});
