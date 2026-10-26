/**
 * In-process fixed-window counter per key (one Strapi process, so no shared store is needed).
 * `blocked-first` marks the first refused hit of a window, so the caller logs once per key per window.
 */
export type RateDecision = 'allowed' | 'blocked-first' | 'blocked';

export interface RateLimiter {
  hit(key: string): RateDecision;
  size(): number;
}

type Window = { start: number; count: number };

export function createRateLimiter(limit: number, windowMs: number, now: () => number = Date.now): RateLimiter {
  const windows = new Map<string, Window>();
  let lastPrune = now();
  const prune = (t: number) => {
    if (t - lastPrune < windowMs) return;
    for (const [key, w] of windows) if (t - w.start >= windowMs) windows.delete(key);
    lastPrune = t;
  };
  return {
    hit(key) {
      const t = now();
      prune(t);
      const current = windows.get(key);
      const w = current && t - current.start < windowMs ? current : { start: t, count: 0 };
      w.count += 1;
      windows.set(key, w);
      if (w.count <= limit) return 'allowed';
      return w.count === limit + 1 ? 'blocked-first' : 'blocked';
    },
    size: () => windows.size,
  };
}
