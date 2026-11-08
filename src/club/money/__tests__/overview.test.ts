import { describe, expect, it } from 'vitest';
import { readDue } from '../../presence/due/reads';
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

  it('left and due are the De incasat totals of the month (S25)', async () => {
    const seed = moneySeed();
    const page = await readDue(seed.store, '2026-11', TODAY);
    const left = page.school.reduce((n, r) => n + r.left, 0) + page.club.reduce((n, r) => n + r.left, 0);
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
    // on 2026-10-31 sub-a2 (valid until 10-31) is still active, sub-a1 had not started
    expect(o.cards.activeSubscriptions).toBe(1);
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
});
