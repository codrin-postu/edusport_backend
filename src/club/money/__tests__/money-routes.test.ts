import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import payments from '../../../api/club/controllers/payments';
import paymentRoutes from '../../../api/club/routes/11-payments';
import { areaOfRoute } from '../../admin-area';
import { readAccounting, readAccountingData, readMoneyMonth } from '../service';
import { moneySeed } from './money-seed';

const source = readFileSync(join(__dirname, '../../../api/club/controllers/payments.ts'), 'utf8');
const money = paymentRoutes.routes.filter((r) => r.path.startsWith('/club/money/'));
type Ctx = { params: Record<string, string>; query: Record<string, unknown>; request: { body: unknown; header: Record<string, string> }; status: number; body: unknown; set: (k: string, v: string) => void };
const ctxOf = (query: Record<string, unknown>): Ctx => ({ params: {}, query, request: { body: null, header: {} }, status: 200, body: null, set: () => undefined });
const call = (name: string, ctx: Ctx): Promise<void> => (payments as unknown as Record<string, (c: Ctx) => Promise<void>>)[name](ctx);

describe('money routes', () => {
  it('are the four money routes, all area money, and their handlers exist', () => {
    expect(money.map((r) => `${r.method} ${r.path} ${r.handler}`)).toEqual([
      'GET /club/money/overview payments.moneyOverview', 'GET /club/money/accounting payments.accounting',
      'GET /club/money/accounting.xlsx payments.accountingXlsx', 'GET /club/money/accounting.csv payments.accountingCsv',
    ]);
    for (const r of money) {
      expect(areaOfRoute(r.config), r.path).toBe('money');
      expect(typeof (payments as Record<string, unknown>)[r.handler.split('.')[1]], r.handler).toBe('function');
    }
  });

  it('are declared before the first parameter path', () => {
    const paths = paymentRoutes.routes.map((r) => r.path);
    const firstParam = paths.findIndex((p) => p.includes(':'));
    for (const r of money) expect(paths.indexOf(r.path)).toBeLessThan(firstParam);
  });
});

describe('money service', () => {
  it('a month is valid up to the current one', () => {
    expect(readMoneyMonth('2026-11', '2026-11-20')).toBe('2026-11');
    expect(readMoneyMonth('2026-10', '2026-11-20')).toBe('2026-10');
    expect(readMoneyMonth('2026-12', '2026-11-20')).toBeNull();
    expect(readMoneyMonth(undefined, '2026-11-20')).toBeNull();
    expect(readMoneyMonth('2026-1', '2026-11-20')).toBeNull();
  });

  it('the file data names who recorded each payment, one admin read, the e-mail when there is no name', async () => {
    const seed = moneySeed();
    seed.group.admins['admin@example.com'] = 'Ana Admin';
    seed.state.payments = seed.state.payments.map((p) => (p.id === 'p8' ? { ...p, recordedBy: 'cineva@example.com' } : p));
    const data = await readAccountingData(seed.store, '2026-11', '2026-11-20', 'xlsx');
    expect(data.extra.recordedBy.get('p1')).toBe('Ana Admin');
    expect(data.extra.recordedBy.get('p8')).toBe('cineva@example.com');
    expect(data.extra.collectedAtRink.get('p1')).toBe(false);
    expect(data.accounting.payments).toHaveLength(6);
    expect(data.overview?.month).toBe('2026-11');
  });

  it('the CSV data reads only the month payments, athletes, abonamente and seasons, and builds no overview (F4)', async () => {
    const seed = moneySeed();
    for (const m of ['attendances', 'lessons', 'groups', 'sections', 'memberships'] as const) seed.failOn(m);
    const data = await readAccountingData(seed.store, '2026-11', '2026-11-20', 'csv');
    expect(data.overview).toBeNull();
    expect(data.accounting.payments).toHaveLength(6);
    expect((await readAccounting(seed.store, '2026-11')).payments).toHaveLength(6);
  });
});
