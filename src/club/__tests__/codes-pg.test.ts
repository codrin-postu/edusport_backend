import { createRequire } from 'node:module';
import type { Core } from '@strapi/strapi';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { codesBackfillPorts, runCodesBackfill } from '../codes-backfill';
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
  let seasonId = '';
  const context = (today = '2026-11-08'): PresenceContext => ({
    store: strapiPresenceStore(strapi), actor: 'admin@example.com', today, now: () => new Date(), log: () => undefined, paymentEmails: () => undefined,
  });
  beforeAll(async () => {
    strapi = await createStrapi(await compileStrapi()).load();
    await ensurePresenceIndexes(strapi.db.connection);
    seasonId = (await strapi.documents('api::season.season').create({ data: { label: '2026-2027', startMonth: '2026-09-01', endMonth: '2027-08-31' } as never })).documentId;
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

  const legacy = (athleteId: string, purchasedAt: string | null, code: string | null = null) =>
    strapi.documents('api::subscription.subscription').create({
      data: {
        athlete: athleteId, season: seasonId, priceList: priceListId, itemName: 'Abonament vechi', slots: 8, startsOn: '2026-09-15', validUntil: '2026-10-12', purchasedAt, code, audience: 'member',
      } as never,
    });
  const codeOf = async (id: string): Promise<string | null> => (await strapi.db.connection('club_subscriptions').where('document_id', id).first('code')).code;
  const counter = () => strapiPresenceStore(strapi).counterValue('subscription');
  const nums = (codes: (string | null)[]): number[] => codes.map((c) => Number((c ?? '').replace('A-', ''))).sort((a, b) => a - b);

  it('backfills the rows without a code in purchase order after the highest code, once; a second boot assigns nothing', async () => {
    const start = await counter();
    const high = await legacy(athletes[0], '2026-10-02T10:00:00.000Z', `A-${String(start + 3).padStart(4, '0')}`);
    const late = await legacy(athletes[1], '2026-10-03T10:00:00.000Z');
    const early = await legacy(athletes[2], '2026-10-01T10:00:00.000Z');
    const none = await legacy(athletes[3], null);
    const logs: string[] = [];
    expect(await runCodesBackfill(codesBackfillPorts(strapi), (m) => logs.push(m))).toEqual({ assigned: 3 });
    const at = (n: number) => `A-${String(n).padStart(4, '0')}`;
    expect(await Promise.all([early, late, none].map((r) => codeOf(r.documentId)))).toEqual([at(start + 4), at(start + 5), at(start + 6)]);
    expect(await codeOf(high.documentId)).toBe(at(start + 3));
    expect(await counter()).toBe(start + 6);
    expect(logs).toEqual(['[codes] backfill: 3 abonamente']);
    logs.length = 0;
    expect(await runCodesBackfill(codesBackfillPorts(strapi), (m) => logs.push(m))).toEqual({ assigned: 0 });
    expect([logs, await counter()]).toEqual([[], start + 6]);
  });

  it('a failure midway leaves no code and no counter change in the real database', async () => {
    const before = await counter();
    const rows = await Promise.all([athletes[4], athletes[5], athletes[6]].map((a) => legacy(a, '2026-10-05T10:00:00.000Z')));
    const real = codesBackfillPorts(strapi);
    let writes = 0;
    const flaky = { ...real, setCode: async (id: string, code: string) => { await real.setCode(id, code); writes += 1; if (writes === 2) throw new Error('boom'); } };
    await expect(runCodesBackfill(flaky, () => undefined)).rejects.toThrow('boom');
    expect(await Promise.all(rows.map((r) => codeOf(r.documentId)))).toEqual([null, null, null]);
    expect(await counter()).toBe(before);
    expect((await runCodesBackfill(codesBackfillPorts(strapi), () => undefined)).assigned).toBe(3);
  });

  it('a backfill and 10 creates at the same moment never share a number or leave a null', async () => {
    await Promise.all([athletes[7], athletes[8], athletes[9], athletes[10], athletes[11]].map((a) => legacy(a, '2026-10-06T10:00:00.000Z')));
    const body = (i: number) => ({ itemKey: 'Abonament 8 ședințe', priceListId, startsOn: `2026-11-${String(10 + i).padStart(2, '0')}`, cover: [], payment: null });
    const creates = athletes.slice(12, 20).concat(athletes.slice(0, 2)).map((id, i) => addSubscription(context(), id, body(i)));
    const [backfill, ...created] = await Promise.all([runCodesBackfill(codesBackfillPorts(strapi), () => undefined), ...creates]);
    expect(created.filter((r) => !r.ok)).toEqual([]);
    expect(backfill.assigned).toBe(5);
    const codes = (await strapi.db.connection('club_subscriptions').select('code')).map((r: { code: string | null }) => r.code);
    expect(codes.filter((c: string | null) => c === null)).toEqual([]);
    expect(new Set(codes).size).toBe(codes.length);
    expect(await counter()).toBe(nums(codes)[codes.length - 1]);
  });
});
