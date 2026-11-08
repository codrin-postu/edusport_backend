export const SUBSCRIPTION_KEY = 'subscription';
export const RECEIPT_KEY = (year: number): string => `receipt:${year}`;

function assertSeq(seq: number): void {
  if (!Number.isInteger(seq) || seq < 1) throw new RangeError(`Sequence out of range: ${seq}`);
}

/** `A-` and the sequence, at least 4 digits, e.g. `A-0124`, `A-10000`. */
export function formatSubscriptionCode(n: number): string {
  assertSeq(n);
  return `A-${String(n).padStart(4, '0')}`;
}

export function parseSubscriptionCode(v: string | null | undefined): number | null {
  const m = /^A-(\d{4,})$/.exec(v ?? '');
  return m ? Number(m[1]) : null;
}

/** `<year>-<sequence, at least 4 digits>`, e.g. `2026-0412`. */
export function formatReceiptNo(year: number, n: number): string {
  assertSeq(n);
  return `${year}-${String(n).padStart(4, '0')}`;
}

export function parseReceiptNo(v: string | null | undefined): { year: number; seq: number } | null {
  const m = /^(\d{4})-(\d{4,})$/.exec(v ?? '');
  return m ? { year: Number(m[1]), seq: Number(m[2]) } : null;
}

export type BackfillInput = { id: string; purchasedAt: string | null; createdAt: string | null; numericId: number; code: string | null };

const time = (v: string | null): number => {
  const t = v ? Date.parse(v) : NaN;
  return Number.isNaN(t) ? Infinity : t;
};

function inPurchaseOrder(a: BackfillInput, b: BackfillInput): number {
  const byPurchase = time(a.purchasedAt) - time(b.purchasedAt);
  if (byPurchase !== 0 && !Number.isNaN(byPurchase)) return byPurchase;
  const byCreated = time(a.createdAt) - time(b.createdAt);
  if (byCreated !== 0 && !Number.isNaN(byCreated)) return byCreated;
  return a.numericId - b.numericId;
}

/** Rows without a code, oldest purchase first (nulls last), numbered after the highest of the counter and every code in use. */
export function planCodeBackfill(rows: BackfillInput[], counter: number): { assign: { id: string; code: string }[]; counterAtLeast: number } {
  const highest = Math.max(counter, ...rows.map((r) => parseSubscriptionCode(r.code) ?? 0));
  const assign = rows.filter((r) => !r.code).sort(inPurchaseOrder).map((r, i) => ({ id: r.id, code: formatSubscriptionCode(highest + i + 1) }));
  return { assign, counterAtLeast: highest + assign.length };
}
