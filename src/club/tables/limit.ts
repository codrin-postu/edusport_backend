/** Promise-only helpers for the table queries and exports: a FIFO limiter and a work budget. */

/** At most `max` jobs run at once; the others wait in arrival order and never fail for waiting. */
export function createLimiter(max: number): <T>(work: () => Promise<T>) => Promise<T> {
  let running = 0;
  const waiting: (() => void)[] = [];
  const release = (): void => {
    const next = waiting.shift();
    if (next) next();
    else running -= 1;
  };
  return async <T>(work: () => Promise<T>): Promise<T> => {
    if (running >= max) await new Promise<void>((resolve) => waiting.push(resolve));
    else running += 1;
    try {
      return await work();
    } finally {
      release();
    }
  };
}

/** Shared by the tables and the 11-5 accounting export: two at a time per process. */
export const exportLimit = createLimiter(2);

export class BudgetError extends Error {
  constructor() {
    super('table budget spent');
    this.name = 'BudgetError';
  }
}
export type Budget = { check(): void };

/** The clock starts here, when the work starts (not when it was queued); `check()` throws past `ms`. */
export function startBudget(ms: number, now: () => number): Budget {
  const start = now();
  return { check: () => { if (now() - start > ms) throw new BudgetError(); } };
}
