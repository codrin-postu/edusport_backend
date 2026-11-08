import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import payments from '../../../api/club/controllers/payments';
import paymentRoutes from '../../../api/club/routes/11-payments';
import { areaOfRoute } from '../../admin-area';
import { monthOf } from '../../presence/dates';
import { todayIso } from '../../groups/http';
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

describe('the payments controller (source)', () => {
  it('limits the files, logs one line each without names, and sends both content types', () => {
    expect(source).toContain('exportLimit(');
    expect(source).toContain('downloadLogLine(');
    expect(source).toContain("'accounting-xlsx'");
    expect(source).toContain("'accounting-csv'");
    expect(source).toContain("'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'");
    expect(source).toContain("'text/csv; charset=utf-8'");
    expect(source).toMatch(/accountingName\(/);
    for (const l of source.split('\n').filter((x) => x.includes('downloadLogLine('))) expect(l).not.toMatch(/name|filename|email/i);
  });

  it('builds the store per request and reads only through it', () => {
    expect(source).not.toMatch(/^const \w+ = strapiPresenceStore/m);
    expect(source).not.toContain('strapi.db.query');
    expect(source).toContain('verifiedAdminId(');
  });

  it('the xlsx route answers 501 with the COPY NEEDED text before any read (flip with 11-4 Task 2)', async () => {
    const ctx = ctxOf({ month: monthOf(todayIso()) });
    await call('accountingXlsx', ctx);
    expect(ctx.status).toBe(501);
    expect((ctx.body as { error: { message: string } }).error.message).toContain('COPY NEEDED');
  });

  it('every route refuses a missing, malformed or later month with 400, before any read', async () => {
    for (const name of ['moneyOverview', 'accounting', 'accountingXlsx', 'accountingCsv']) {
      for (const month of [undefined, '2026-13', 'noiembrie', '2999-01']) {
        const ctx = ctxOf({ month });
        await call(name, ctx);
        expect(ctx.status, `${name} ${String(month)}`).toBe(400);
      }
    }
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
