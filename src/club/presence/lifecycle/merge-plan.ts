import { attendanceKey } from '../sessions';
import { sumMoney } from '../money';
import type { AttendanceRow, AttendanceWrite, Billing, Charge } from '../types';

export type AttendanceMergePlan = { remove: string[]; update: { id: string; data: Partial<AttendanceWrite> }[] };
type Merged = Pick<AttendanceWrite, 'grup' | 'uscat' | 'visitor' | 'subscriptionId' | 'billing' | 'charges' | 'amount'>;
type Billed = Charge & { price: number };

const SCHOOL: Billing[] = ['slot', 'fara_abonament'];
const TYPE_ORDER: Charge['type'][] = ['grup', 'uscat'];
const isSchool = (row: AttendanceRow): boolean => SCHOOL.includes(row.billing);

/** Each frozen charge once, the kept row's winning over the removed row's of the same type. */
function unionCharges(kept: AttendanceRow, removed: AttendanceRow): Charge[] {
  const all = [...kept.charges, ...removed.charges];
  return TYPE_ORDER.map((t) => all.find((c) => c.type === t)).filter((c): c is Charge => c !== undefined);
}

function clubBilling(charges: Charge[]): { billing: Billing; amount: number } {
  const billed = charges.filter((c): c is Billed => !c.included && c.price !== null);
  if (billed.length > 0) return { billing: 'club', amount: sumMoney(billed.map((c) => c.price)) };
  return { billing: charges.some((c) => c.included) ? 'inclus' : 'fara_pret', amount: 0 };
}

/** The abonament slot of the kept row wins, else the removed row's (C38); no slot on either keeps the kept row's billing. */
function schoolBilling(kept: AttendanceRow, removed: AttendanceRow): Pick<Merged, 'subscriptionId' | 'billing'> {
  const slot = [kept, removed].find((r) => r.billing === 'slot' && r.subscriptionId !== null) ?? kept;
  return { subscriptionId: slot.subscriptionId, billing: slot.billing };
}

/** Decided 5: the kept row's fields after a union with the removed row at the same session. */
export function mergedAttendance(kept: AttendanceRow, removed: AttendanceRow): Merged {
  const charges = unionCharges(kept, removed);
  const common = { grup: kept.grup || removed.grup, uscat: kept.uscat || removed.uscat, visitor: kept.visitor && removed.visitor, charges };
  if (isSchool(kept) && isSchool(removed)) return { ...common, ...schoolBilling(kept, removed), amount: 0 };
  return { ...common, subscriptionId: null, ...clubBilling(charges) };
}

const byId = (a: { id: string }, b: { id: string }): number => a.id.localeCompare(b.id);

/** `remove` = removed rows at a session the kept athlete also has; `update` = the merged kept rows, then the other removed rows moved and rekeyed. */
export function planAttendanceMerge(kept: AttendanceRow[], removed: AttendanceRow[], keptId: string): AttendanceMergePlan {
  const keptBySession = new Map(kept.map((k) => [k.sessionId, k]));
  const plan: AttendanceMergePlan = { remove: [], update: [] };
  const merged = new Map<string, Partial<AttendanceWrite>>();
  const moved: AttendanceMergePlan['update'] = [];
  for (const r of removed) {
    const k = keptBySession.get(r.sessionId);
    if (k) {
      plan.remove.push(r.id);
      merged.set(k.id, mergedAttendance(k, r));
    } else moved.push({ id: r.id, data: { athleteId: keptId, uniqueKey: attendanceKey(r.sessionId, keptId) } });
  }
  plan.update = [...[...merged].map(([id, data]) => ({ id, data })).sort(byId), ...moved.sort(byId)];
  return plan;
}
