import { describe, expect, it } from 'vitest';
import { restanteBlocks } from '../../bani/restante';
import { athleteRow, member } from '../../groups/__tests__/fake-group-store';
import { lessonRow, subscriptionRow } from '../../presence/__tests__/fake-store';
import { readDue } from '../../presence/due/reads';
import { listSubscriptions } from '../../presence/subscriptions/reads';
import { moneyOverview } from '../overview';
import { loadMoneySources } from '../sources';
import type { MoneyOverview } from '../types';
import { moneySeed, TODAY } from './money-seed';

async function overviewOf(month: string, today: string): Promise<MoneyOverview> {
  const seed = moneySeed();
  return moneyOverview(await loadMoneySources(seed.store, month), month, today);
}
const group = (o: MoneyOverview, name: string) => o.bySection.flatMap((s) => s.groups).find((g) => g.groupName === name)!;

describe('money overview', () => {
  it('cards for the month (5.6.1)', async () => {
    const o = await overviewOf('2026-11', TODAY);
    // November by paidOn, cancelled out: 200 + 300 + 180 + 120; October: 120
    expect(o.cards).toMatchObject({ collected: 800, collectedPrev: 120, activeSubscriptions: 1, expiring: 1, unpaidAthletes: 3 });
    expect(o.cards.schoolAthletes).toBe(3);
  });

  it('left is the sum of the Restante totals and due the De incasat total of the month (S25)', async () => {
    const seed = moneySeed();
    const page = await readDue(seed.store, '2026-11', TODAY);
    const left = restanteBlocks(page, 'toate').reduce((n, b) => n + b.total, 0);
    const due = page.school.reduce((n, r) => n + r.price, 0) + page.club.reduce((n, r) => n + r.due, 0);
    const o = moneyOverview(await loadMoneySources(seed.store, '2026-11'), '2026-11', TODAY);
    expect(o.cards.left).toBe(left);
    expect(o.cards.due).toBe(due);
    expect(left).toBeGreaterThan(0);
  });

  it('breakdown pays the month dues oldest line first, whenever paid (S27)', async () => {
    const o = await overviewOf('2026-11', '2026-12-05');
    expect(group(o, 'Avansați').totals).toEqual({ due: 550, paid: 400, left: 150, percent: 73 });
    expect(group(o, 'Fără datorii').totals).toEqual({ due: 0, paid: 0, left: 0, percent: null });
    expect(group(o, 'Intermediari Bronze').totals).toEqual({ due: 320, paid: 200, left: 120, percent: 63 });
    const club = o.bySection.find((s) => s.sectionId === 'club')!;
    expect(club.totals).toEqual({ due: 550, paid: 400, left: 150, percent: 73 });
  });

  it('a lesson of the month counts on the main group at the lesson date, a cancelled abonament is out of Datorat', async () => {
    const o = await overviewOf('2026-11', TODAY);
    expect(group(o, 'Avansați').totals.due).toBe(550);
    expect(group(o, 'Intermediari Bronze').totals.due).toBe(320);
  });

  it('a Club month paid across two dates: the card of the next month counts the second by its date', async () => {
    expect((await overviewOf('2026-12', '2026-12-05')).cards.collected).toBe(100);
  });

  it('a past month uses its last day as reference day (S26)', async () => {
    const o = await overviewOf('2026-10', TODAY);
    // on 2026-10-31 sub-a2 (valid until 10-31) is active; sub-a1 and sub-a3 are bought ahead and count as the Abonamente list counts them (F3)
    expect(o.cards.activeSubscriptions).toBe(3);
    expect(o.cards.expiring).toBe(1);
  });

  it('byMethod and byPurpose count non-cancelled payments by paidOn', async () => {
    const o = await overviewOf('2026-11', TODAY);
    expect(o.byMethod).toEqual([
      { key: 'numerar', label: 'Numerar', paid: 180, count: 1 }, { key: 'card', label: 'Card (POS)', paid: 320, count: 2 }, { key: 'transfer', label: 'Transfer bancar', paid: 300, count: 1 },
    ]);
    expect(o.byPurpose.map((r) => [r.key, r.paid, r.count])).toEqual([['abonament', 200, 1], ['cotizatie', 180, 1], ['club_luna', 300, 1], ['lectie', 0, 0], ['altceva', 120, 1]]);
  });

  it('a month with no payments has empty tallies', async () => {
    const o = await overviewOf('2026-09', TODAY);
    expect(o.cards.collected).toBe(0);
    expect(o.byMethod.every((r) => r.paid === 0 && r.count === 0)).toBe(true);
  });

  it('money with no main group goes to a Fără grupă row, so the totals reconcile with the cards (F1)', async () => {
    const seed = moneySeed();
    seed.state.subscriptions = [];
    seed.state.payments = seed.state.payments.filter((p) => p.purpose !== 'abonament');
    seed.group.athletes.push(athleteRow({ id: 'a7', name: 'Lia Solo' }));
    seed.state.lessons.push(lessonRow({ id: 'l2', athleteId: 'a7', date: '2026-11-10', state: 'saved', present: true, price: 100, amount: 100 }));
    const o = moneyOverview(await loadMoneySources(seed.store, '2026-11'), '2026-11', TODAY);
    const last = o.bySection[o.bySection.length - 1];
    expect(last.groups).toHaveLength(1);
    expect(last.groups[0]).toMatchObject({ groupName: 'Fără grupă', totals: { due: 100, paid: 0, left: 100, percent: 0 } });
    const sum = (pick: (m: { due: number; paid: number; left: number }) => number) => o.bySection.reduce((n, b) => n + pick(b.totals), 0);
    expect(sum((m) => m.due)).toBe(o.cards.due);
    expect(sum((m) => m.left)).toBe(o.cards.left);
  });

  it('a group with no section keeps its money in the Fără grupă row (F1)', async () => {
    const seed = moneySeed();
    seed.group.groups = seed.group.groups.map((g) => (g.id === 'g-av' ? { ...g, sectionId: null } : g));
    const o = moneyOverview(await loadMoneySources(seed.store, '2026-11'), '2026-11', TODAY);
    expect(o.bySection[o.bySection.length - 1].groups[0]).toMatchObject({ groupName: 'Fără grupă', totals: { due: 550, paid: 400 } });
  });

  it('the abonament price goes to the Școala group of the athlete, not to a main Club group (F2)', async () => {
    const seed = moneySeed();
    seed.group.memberships = [
      ...seed.group.memberships.map((m) => (m.id === 'm1' ? { ...m, isMain: false } : m)),
      member({ id: 'm9', athleteId: 'a1', groupId: 'g-av' }),
    ];
    const o = moneyOverview(await loadMoneySources(seed.store, '2026-11'), '2026-11', TODAY);
    expect(group(o, 'Intermediari Bronze').totals).toMatchObject({ due: 320, paid: 200 });
    expect(group(o, 'Avansați').totals.due).toBe(550);
  });

  it('an abonament of an athlete with no Școala group falls back to Fără grupă (F2)', async () => {
    const seed = moneySeed();
    seed.group.memberships = seed.group.memberships.filter((m) => m.id !== 'm2');
    const o = moneyOverview(await loadMoneySources(seed.store, '2026-10'), '2026-10', TODAY);
    expect(o.bySection[o.bySection.length - 1].groups[0]).toMatchObject({ groupName: 'Fără grupă', totals: { due: 320, paid: 120 } });
  });

  it('the abonament cards count exactly what the Abonamente list counts for their filter (F3)', async () => {
    const seed = moneySeed();
    seed.state.subscriptions.push(
      subscriptionRow({ id: 'sub-ahead', athleteId: 'a4', code: 'A-0004', startsOn: '2026-11-25', validUntil: '2026-12-02' }),
      subscriptionRow({ id: 'sub-old', athleteId: 'a5', code: 'A-0005', seasonId: 's25', startsOn: '2026-11-10', validUntil: '2026-11-25' }),
    );
    const o = moneyOverview(await loadMoneySources(seed.store, '2026-11'), '2026-11', TODAY);
    const rows = async (state: string) => (await listSubscriptions(seed.store, { state }, TODAY)).rows.length;
    expect(o.cards.activeSubscriptions).toBe(await rows('active'));
    expect(o.cards.expiring).toBe(await rows('expira14'));
    expect(o.cards.activeSubscriptions).toBe(2);
  });

  it('a cancellation at 01:30 local time counts on its local day (F7)', async () => {
    // 2026-11-04T23:30Z is 01:30 on 5 November in Bucharest: on 4 November sub-a3 is still active
    const seed = moneySeed();
    seed.state.subscriptions = seed.state.subscriptions.map((s) => (s.id === 'sub-a3' ? { ...s, cancelledAt: '2026-11-04T23:30:00.000Z' } : s));
    const o = moneyOverview(await loadMoneySources(seed.store, '2026-11'), '2026-11', '2026-11-04');
    expect(o.cards.activeSubscriptions).toBe(2);
  });
});
