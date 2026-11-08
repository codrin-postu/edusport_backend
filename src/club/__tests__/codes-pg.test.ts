import { createRequire } from 'node:module';
import type { Core } from '@strapi/strapi';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensurePresenceIndexes } from '../presence/indexes';
import type { PresenceContext } from '../presence/context';
import { recordPayment } from '../presence/payments/record';
import { strapiPresenceStore } from '../presence/strapi-store';
import { addSubscription } from '../presence/subscriptions/add';

/**
 * Runs only with PRESENCE_PG_TEST=1 and DATABASE_* pointing at a throwaway Postgres 16 (never a shared database): it boots Strapi,
 * which creates the schema, then drives the real create paths. Every parallel caller builds its own store, as every request does.
 */
const { compileStrapi, createStrapi } = createRequire(__filename)('@strapi/strapi') as typeof import('@strapi/strapi');
const enabled = process.env.PRESENCE_PG_TEST === '1';
const COUNT = 20;

describe.skipIf(!enabled)('abonament codes and receipt numbers on Postgres', () => {
  let strapi: Core.Strapi;
  let athletes: string[] = [];
  let priceListId = '';
  const context = (today = '2026-11-08'): PresenceContext => ({
    store: strapiPresenceStore(strapi), actor: 'admin@example.com', today, now: () => new Date(), log: () => undefined, paymentEmails: () => undefined,
  });
  beforeAll(async () => {
    strapi = await createStrapi(await compileStrapi()).load();
    await ensurePresenceIndexes(strapi.db.connection);
    await strapi.documents('api::season.season').create({ data: { label: '2026-2027', startMonth: '2026-09-01', endMonth: '2027-08-31' } as never });
    const section = await strapi.documents('api::section.section').create({ data: { name: 'Scoala PG', slug: 'scoala-pg', kind: 'school' } as never });
    const list = await strapi.documents('api::price-list.price-list').create({
      data: { name: 'Standard PG', section: section.documentId, items: [{ name: 'Abonament 8 ședințe', kind: 'subscription', sessions: 8, memberPrice: 320, nonMemberPrice: 360 }] } as never,
    });
    priceListId = list.documentId;
    athletes = [];
    for (let i = 0; i < COUNT; i += 1) {
      athletes.push((await strapi.documents('api::athlete.athlete').create({ data: { name: `Sportiv PG ${i}`, status: 'activ' } as never })).documentId);
    }
  }, 240_000);
  afterAll(async () => {
    await strapi?.db.connection.destroy();
  });

  it('the code and the receipt number have database unique indexes', async () => {
    const rows = await strapi.db.connection.raw("select indexdef from pg_indexes where tablename in ('club_subscriptions','club_payments') and indexdef ilike '%unique%'");
    const defs = (rows.rows as { indexdef: string }[]).map((r) => r.indexdef).join('\n');
    expect(defs).toMatch(/\(code\)/);
    expect(defs).toMatch(/\(receipt_no\)/);
  });

  const sorted = (n: (string | null)[]): (string | null)[] => [...n].sort();
  const stored = async (table: string, column: string): Promise<(string | null)[]> =>
    (await strapi.db.connection(table).select(column)).map((r: Record<string, string | null>) => r[column]);

  it('20 admins adding an abonament with a payment at once get 20 distinct consecutive codes and receipt numbers', async () => {
    const body = { itemKey: 'Abonament 8 ședințe', priceListId, startsOn: '2026-11-02', cover: [], payment: { amount: 100, method: 'numerar', collectedAtRink: false, sendEmail: false } };
    const results = await Promise.all(athletes.map((id) => addSubscription(context(), id, body)));
    expect(results.map((r) => r.ok)).toEqual(Array(COUNT).fill(true));
    const codes = Array.from({ length: COUNT }, (_, i) => `A-${String(i + 1).padStart(4, '0')}`);
    expect(sorted(await stored('club_subscriptions', 'code'))).toEqual(codes);
    const receipts = Array.from({ length: COUNT }, (_, i) => `2026-${String(i + 1).padStart(4, '0')}`);
    expect(sorted(await stored('club_payments', 'receipt_no'))).toEqual(receipts);
  });

  it('20 parallel payments over two years number each year on its own, and a refused one takes no number', async () => {
    const pay = (athleteId: string, paidOn: string) => ({ athleteId, amount: 50, paidOn, method: 'numerar', for: { kind: 'altceva' }, collectedAtRink: false, note: '', sendEmail: false });
    const results = await Promise.all(athletes.map((id, i) => recordPayment(context('2027-01-05'), pay(id, i % 2 === 0 ? '2026-11-08' : '2027-01-02'))));
    expect(results.filter((r) => !r.ok)).toEqual([]);
    expect((await recordPayment(context('2027-01-05'), pay('missing-athlete', '2026-11-08'))).ok).toBe(false);
    const numbers = (await stored('club_payments', 'receipt_no')) as string[];
    const of = (year: string) => numbers.filter((n) => n.startsWith(year)).sort();
    expect(of('2026')).toHaveLength(COUNT + COUNT / 2);
    expect(of('2026')[COUNT + COUNT / 2 - 1]).toBe(`2026-${String(COUNT + COUNT / 2).padStart(4, '0')}`);
    expect(of('2027')).toEqual(Array.from({ length: COUNT / 2 }, (_, i) => `2027-${String(i + 1).padStart(4, '0')}`));
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it('a refused abonament in the same wave takes no number', async () => {
    const before = await strapiPresenceStore(strapi).counterValue('subscription');
    const bad = { itemKey: 'Nu exista', priceListId, startsOn: '2026-11-03', cover: [], payment: null };
    expect((await addSubscription(context(), athletes[0], bad)).ok).toBe(false);
    expect(await strapiPresenceStore(strapi).counterValue('subscription')).toBe(before);
  });
});
