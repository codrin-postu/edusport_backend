import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { BackfillInput } from '../codes';
import { runCodesBackfill, type CodesBackfillPorts } from '../codes-backfill';

const row = (id: string, purchasedAt: string | null, code: string | null): BackfillInput => ({ id, purchasedAt, createdAt: null, numericId: Number(id.replace(/\D/g, '')), code });

/** In-memory ports: the transaction restores the rows and the counters when its work throws, as a rollback does. */
function memoryPorts(rows: BackfillInput[], counters: Record<string, number> = {}, over: Partial<CodesBackfillPorts> = {}) {
  const state = { rows, counters, locked: 0, inTransaction: false };
  const ports: CodesBackfillPorts = {
    async transaction(work) {
      const snapshot = structuredClone({ rows: state.rows, counters: state.counters });
      state.inTransaction = true;
      try {
        return await work();
      } catch (err) {
        Object.assign(state, snapshot);
        throw err;
      } finally {
        state.inTransaction = false;
      }
    },
    lockAll: async () => { state.locked += 1; },
    rows: async () => structuredClone(state.rows),
    setCode: async (id, code) => { state.rows = state.rows.map((r) => (r.id === id ? { ...r, code } : r)); },
    counterValue: async (key) => state.counters[key] ?? 0,
    raiseCounter: async (key, n) => { state.counters[key] = Math.max(state.counters[key] ?? 0, n); },
    ...over,
  };
  return { ports, state };
}
const seeded = () => [row('s1', '2026-10-01', null), row('s2', '2026-10-02', 'A-0002'), row('s3', '2026-10-03', null), row('s4', null, null)];

describe('runCodesBackfill', () => {
  it('numbers the rows without a code in purchase order after the highest, raises the counter, logs once', async () => {
    const { ports, state } = memoryPorts(seeded());
    const logs: string[] = [];
    expect(await runCodesBackfill(ports, (m) => logs.push(m))).toEqual({ assigned: 3 });
    expect(state.rows.map((r) => [r.id, r.code])).toEqual([['s1', 'A-0003'], ['s2', 'A-0002'], ['s3', 'A-0004'], ['s4', 'A-0005']]);
    expect(state.counters.subscription).toBe(5);
    expect(logs).toEqual(['[codes] backfill: 3 abonamente']);
    expect(state.locked).toBe(1);
  });

  it('a second run assigns nothing, logs nothing and keeps the counter', async () => {
    const { ports, state } = memoryPorts(seeded());
    await runCodesBackfill(ports, () => undefined);
    const logs: string[] = [];
    expect(await runCodesBackfill(ports, (m) => logs.push(m))).toEqual({ assigned: 0 });
    expect(logs).toEqual([]);
    expect(state.counters.subscription).toBe(5);
  });

  it('is a no-op on an empty table and writes no counter row (S64)', async () => {
    const { ports, state } = memoryPorts([]);
    const logs: string[] = [];
    expect(await runCodesBackfill(ports, (m) => logs.push(m))).toEqual({ assigned: 0 });
    expect([logs, state.counters]).toEqual([[], {}]);
  });

  it('starts after a counter above every code, and never lowers it', async () => {
    const { ports, state } = memoryPorts([row('s1', '2026-10-01', null), row('s2', '2026-10-02', 'A-0003')], { subscription: 9 });
    await runCodesBackfill(ports, () => undefined);
    expect(state.rows[0].code).toBe('A-0010');
    expect(state.counters.subscription).toBe(10);
    const all = memoryPorts([row('s1', '2026-10-01', 'A-0003')], { subscription: 9 });
    await runCodesBackfill(all.ports, () => undefined);
    expect(all.state.counters.subscription).toBe(9);
  });

  it('takes the counter row lock before it reads the counter, so a create cannot slip a number in between', async () => {
    const calls: string[] = [];
    const base = memoryPorts(seeded());
    const spy = (name: keyof CodesBackfillPorts) => async (...args: never[]) => { calls.push(name); return (base.ports[name] as (...a: never[]) => Promise<unknown>)(...args); };
    const ports = { ...base.ports, lockAll: spy('lockAll'), rows: spy('rows'), counterValue: spy('counterValue'), raiseCounter: spy('raiseCounter'), setCode: spy('setCode') } as CodesBackfillPorts;
    await runCodesBackfill(ports, () => undefined);
    expect(calls.slice(0, 4)).toEqual(['lockAll', 'rows', 'raiseCounter', 'counterValue']);
  });

  it('a failing write leaves no code and no counter, and the error reaches the caller', async () => {
    const base = memoryPorts(seeded());
    let writes = 0;
    const ports: CodesBackfillPorts = {
      ...base.ports,
      setCode: async (id, code) => {
        await base.ports.setCode(id, code);
        writes += 1;
        if (writes === 2) throw new Error('disk full');
      },
    };
    await expect(runCodesBackfill(ports, () => undefined)).rejects.toThrow('disk full');
    expect(base.state.rows.map((r) => r.code)).toEqual([null, 'A-0002', null, null]);
    expect(base.state.counters).toEqual({});
  });

  it('bootstrap runs it after the presence indexes, in its own try with the [codes] log', () => {
    const index = readFileSync(join(__dirname, '..', '..', 'index.ts'), 'utf8');
    expect(index).toMatch(/ensurePresenceIndexes[\s\S]*runCodesBackfill\(codesBackfillPorts\(strapi\)/);
    expect(index).toContain('[codes] backfill');
  });
});
