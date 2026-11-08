import { describe, expect, it } from 'vitest';
import { createLimiter, exportLimit } from '../limit';

const deferred = () => { let resolve!: () => void; const p = new Promise<void>((r) => { resolve = r; }); return { p, resolve }; };
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe('createLimiter', () => {
  it('runs at most two at a time, the third waits', async () => {
    const limit = createLimiter(2);
    const log: string[] = [];
    const job = (id: string, gate: Promise<void>) => limit(async () => { log.push(`start ${id}`); await gate; log.push(`end ${id}`); });
    const [g1, g2, g3] = [deferred(), deferred(), deferred()];
    const all = Promise.all([job('a', g1.p), job('b', g2.p), job('c', g3.p)]);
    await tick(); expect(log).toEqual(['start a', 'start b']);
    g1.resolve(); await tick(); expect(log).toContain('start c');
    g2.resolve(); g3.resolve(); await all;
  });
  it('starts waiters in arrival order', async () => {
    const limit = createLimiter(1);
    const order: string[] = [];
    const gates = [deferred(), deferred(), deferred()];
    const all = gates.map((g, i) => limit(async () => { order.push(String(i)); await g.p; }));
    await tick();
    gates.forEach((g) => g.resolve());
    await Promise.all(all);
    expect(order).toEqual(['0', '1', '2']);
  });
  it('passes the value and the error of the work, and a failure frees the slot', async () => {
    const limit = createLimiter(1);
    await expect(limit(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    expect(await limit(async () => 7)).toBe(7);
  });
  it('a synchronous throw frees the slot too and a waiter never rejects for waiting', async () => {
    const limit = createLimiter(1);
    const g = deferred();
    const first = limit(() => g.p.then(() => 1));
    const waiting = Array.from({ length: 50 }, (_, i) => limit(async () => i));
    await tick();
    g.resolve();
    expect(await first).toBe(1);
    expect(await Promise.all(waiting)).toHaveLength(50);
    await expect(limit(() => { throw new Error('sync'); })).rejects.toThrow('sync');
    expect(await limit(async () => 'ok')).toBe('ok');
  });
  it('exportLimit is one shared limiter of two', async () => {
    const g = deferred();
    let running = 0; let peak = 0;
    const job = () => exportLimit(async () => { running += 1; peak = Math.max(peak, running); await g.p; running -= 1; });
    const all = Promise.all([job(), job(), job()]);
    await tick();
    expect(peak).toBe(2);
    g.resolve(); await all;
  });
});
