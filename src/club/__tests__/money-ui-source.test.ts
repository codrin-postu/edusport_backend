import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeLatest } from '../../admin/dashboard/bani/latest';
import { runOnce } from '../../admin/dashboard/bani/useSubmitOnce';

describe('money UI source', () => {
  it('one submit per click (decided 1): a second call while one is in flight does not start the work', async () => {
    const flag = { current: false };
    const busy: boolean[] = [];
    let release: (v: string) => void = () => undefined;
    let starts = 0;
    const work = () => { starts += 1; return new Promise<string>((resolve) => { release = resolve; }); };
    const first = runOnce(flag, work, (b) => busy.push(b));
    expect(await runOnce(flag, work, (b) => busy.push(b))).toBeUndefined();
    expect(starts).toBe(1);
    release('done');
    expect(await first).toBe('done');
    expect([flag.current, busy]).toEqual([false, [true, false]]);
    await expect(runOnce(flag, () => Promise.reject(new Error('x')), () => undefined)).rejects.toThrow('x');
    expect(flag.current).toBe(false);   // a failure frees the guard
  });
  it('a slow older answer is dropped (M5)', () => {
    const l = makeLatest();
    const first = l.next();
    const second = l.next();
    expect([first(), second()]).toEqual([false, true]);
    l.cancel();
    expect(second()).toBe(false);
  });
  it('the payment window asks "Pentru" before the amount and shows the amount in the closed select', () => {
    const src = readFileSync(join(__dirname, '../../admin/dashboard/bani/PaymentWindow.tsx'), 'utf8');
    expect(src.indexOf('PAYMENT_COPY.forWhat')).toBeGreaterThan(src.indexOf('<AthleteField'));
    expect(src.indexOf('PAYMENT_COPY.forWhat')).toBeLessThan(src.indexOf('PAYMENT_COPY.amount}'));
    expect(src).toMatch(/<Select triggerHint /);
  });
});
