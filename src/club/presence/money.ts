/** A money amount as a number: a finite number, or numeric text (Postgres decimals come back as "40.00"). Otherwise null. */
export function toMoney(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string' || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Sums in whole bani, so 0.1 + 0.2 is 0.3. */
export const sumMoney = (values: readonly number[]): number => values.reduce((bani, v) => bani + Math.round(v * 100), 0) / 100;

/** 5000 -> "5.000": whole number with "." between thousands. */
export function groupedInt(n: number): string {
  const digits = String(Math.abs(Math.trunc(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return n < 0 ? `-${digits}` : digits;
}

/** "18.640 RON", "1.200,50 RON", "320 RON", "-20 RON". */
export function ron(n: number): string {
  if (Number.isInteger(n)) return `${groupedInt(n)} RON`;
  const [whole, cents] = Math.abs(n).toFixed(2).split('.');
  return `${n < 0 ? '-' : ''}${groupedInt(Number(whole))},${cents} RON`;
}
