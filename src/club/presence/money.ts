/** A money amount as a number: a finite number, or numeric text (Postgres decimals come back as "40.00"). Otherwise null. */
export function toMoney(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string' || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Sums in whole bani, so 0.1 + 0.2 is 0.3. */
export const sumMoney = (values: readonly number[]): number => values.reduce((bani, v) => bani + Math.round(v * 100), 0) / 100;

/** "320 RON", "12,50 RON". */
export function ron(n: number): string {
  const amount = Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',');
  return `${amount} RON`;
}
