import { describe, expect, it, vi } from 'vitest';
import { endEveryAdminSession } from '../end-all-sessions';

describe('endEveryAdminSession', () => {
  it('ends every admin and keeps going after one failure, logging the error name only', async () => {
    const seen: number[] = [];
    const log = vi.fn();
    const out = await endEveryAdminSession([1, 2, 3], async (id) => {
      if (id === 2) throw new TypeError('secret detail');
      seen.push(id);
    }, log);
    expect(out).toEqual({ ended: 2, failed: 1 });
    expect(seen).toEqual([1, 3]);
    expect(log).toHaveBeenCalledWith('[end-sessions] admin 2 failed: TypeError');
  });

  it('with no admins does nothing', async () => {
    expect(await endEveryAdminSession([], async () => { throw new Error('no'); })).toEqual({ ended: 0, failed: 0 });
  });
});
