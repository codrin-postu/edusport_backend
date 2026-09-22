/**
 * Column filters for the submission tables, shared by Înscrieri and Voluntari.
 *
 * Both controllers carried their own copy of this. They had already drifted:
 * the volunteer one also accepts `birthDate` and, because that column is a date
 * rather than a datetime, does not stretch the upper bound to the end of the
 * day. Keeping two copies while adding operators would have widened the gap, so
 * the date columns are now a parameter and the logic lives in one place.
 *
 * The dialect stays `{col, op, val}`, so filters saved by the current admin
 * keep working.
 *
 * Every filter narrows the result, and several values inside one filter mean
 * "any of them". There is deliberately no AND/OR switch: the table is read by
 * people registering children, not by people composing queries, and the two
 * things they actually ask for ("confirmed or contacted", "sent on this date")
 * are covered without one.
 */

export interface ColFilter {
  col: string;
  op: string;
  val: unknown;
}

/** How a column should be compared. Anything absent is treated as text. */
export type DateKind = 'date' | 'datetime';
export interface FilterOptions {
  /** e.g. { submittedAt: 'datetime', birthDate: 'date' } */
  dateCols?: Record<string, DateKind>;
}

const trimOrEmpty = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Parse the `filters` query param (JSON array of {col, op, val}); tolerant of junk. */
export function parseColFilters(raw: unknown): ColFilter[] {
  if (!raw) return [];
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  const out: ColFilter[] = [];
  for (const f of parsed) {
    if (!f || typeof f !== 'object') continue;
    const col = trimOrEmpty((f as any).col);
    const op = trimOrEmpty((f as any).op);
    if (!col || !op) continue;
    out.push({ col, op, val: (f as any).val });
  }
  return out;
}

/** The day's last instant, so an inclusive upper bound covers the whole date. */
function endOfDay(v: string): string {
  return /\d{2}:\d{2}/.test(v) ? v : `${v}T23:59:59.999Z`;
}

function dateClause(f: ColFilter, kind: DateKind): Record<string, unknown> | null {
  const isDateTime = kind === 'datetime';

  if (f.op === 'between') {
    let from = '';
    let to = '';
    const v = f.val;
    if (Array.isArray(v)) {
      from = trimOrEmpty(v[0]);
      to = trimOrEmpty(v[1]);
    } else if (v && typeof v === 'object') {
      from = trimOrEmpty((v as any).from);
      to = trimOrEmpty((v as any).to);
    } else if (typeof v === 'string' && v.includes(',')) {
      const [a, b] = v.split(',');
      from = trimOrEmpty(a);
      to = trimOrEmpty(b);
    }
    const range: Record<string, unknown> = {};
    if (from) range.$gte = from;
    if (to) range.$lte = isDateTime ? endOfDay(to) : to;
    if (!Object.keys(range).length) return null;
    return { [f.col]: range };
  }

  const day = trimOrEmpty(f.val);
  if (!day) return null;

  // On a datetime column a single day is a range, not an equality: stored
  // values carry a time, so `$eq` on the bare date would match nothing.
  if (f.op === 'on') {
    return isDateTime ? { [f.col]: { $gte: day, $lte: endOfDay(day) } } : { [f.col]: { $eq: day } };
  }
  if (f.op === 'before') return { [f.col]: { $lt: day } };
  if (f.op === 'after') {
    return { [f.col]: { $gt: isDateTime ? endOfDay(day) : day } };
  }
  return null;
}

/** One filter to a Strapi clause, or null when it is unusable. */
export function buildColClause(
  f: ColFilter,
  options: FilterOptions = {},
): Record<string, unknown> | null {
  const kind = options.dateCols?.[f.col];
  if (kind) return dateClause(f, kind);
  // A date operator on a text column is meaningless; drop it rather than
  // silently comparing strings.
  if (['between', 'on', 'before', 'after'].includes(f.op)) return null;

  // Several values in one filter mean "any of them". This is what the status
  // and level pickers send when more than one box is ticked.
  if (f.op === 'anyOf') {
    const raw = Array.isArray(f.val) ? f.val : typeof f.val === 'string' ? f.val.split(',') : [];
    const vals = raw.map(trimOrEmpty).filter(Boolean);
    if (!vals.length) return null;
    // One value is an equality; no reason to send $in for it.
    return vals.length === 1 ? { [f.col]: { $eq: vals[0] } } : { [f.col]: { $in: vals } };
  }

  const opMap: Record<string, string> = {
    contains: '$containsi',
    equals: '$eq',
    startsWith: '$startsWithi',
  };
  const strapiOp = opMap[f.op];
  if (!strapiOp) return null;
  const v = trimOrEmpty(f.val);
  if (!v) return null;
  return { [f.col]: { [strapiOp]: v } };
}
