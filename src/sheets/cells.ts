/**
 * How one stored value is printed in a Sheet cell (and in the CSV export).
 * Kept apart from `matrix.ts` so the column tables can use them without an import cycle.
 */

/** Booleans as Da/Nu; anything else (null: "not asked") as an empty cell. */
export const yesNo = (v: unknown): string => (v === true ? 'Da' : v === false ? 'Nu' : '');

export const cellStr = (v: unknown): string => (v == null ? '' : String(v));

/** A json string array, comma-joined. */
export const listStr = (v: unknown): string => (Array.isArray(v) ? v.map((x) => cellStr(x)).join(', ') : cellStr(v));

/** A custom answer: booleans as Da/Nu, arrays comma-joined. */
export function extraCell(v: unknown): string {
  if (typeof v === 'boolean') return v ? 'Da' : 'Nu';
  if (Array.isArray(v)) return listStr(v);
  return cellStr(v);
}
