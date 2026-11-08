import type { AthleteRow } from '../athletes/store';
import { acsWord, effectiveAcs } from '../acs';
import { ageFromIso, isoDate, partsFromIso } from '../birth-date';
import { STATUS_WORDS } from '../history-text';
import { monthOf } from '../presence/dates';
import { clubMonths } from '../presence/due/settlement';
import { sumMoney } from '../presence/money';
import { byUseOrder, subscriptionState, usedSlots } from '../presence/subscriptions';
import type { AttendanceRow, PaymentRow, SubscriptionRow } from '../presence/types';
import { coachText, groupBy, groupInfoMap, infoOf, mainKeys, type GroupInfo } from './context';
import { PAYMENT_STATE_VALUES } from './catalog';
import { inRange, type TableSources } from './sources';
import type { CellValue, TableDefinition, TableRow } from './types';

type Range = { from: string; to: string };
type Money = { due: number; paid: number; left: number };
const [PAID, PARTLY, UNPAID] = PAYMENT_STATE_VALUES;

export const paymentState = (m: Money): string | null => {
  if (m.due <= 0) return null;
  if (m.left <= 0) return PAID;
  return m.paid > 0 ? PARTLY : UNPAID;
};

const livePaid = (payments: readonly PaymentRow[], subId: string): number =>
  sumMoney(payments.filter((p) => !p.cancelled && p.purpose === 'abonament' && p.subscriptionId === subId).map((p) => p.amount));

/** Club months inside the period plus the priced, not cancelled abonamente starting in it, with what is paid for each whenever paid. */
function moneyOf(a: AthleteRow, own: { atts: AttendanceRow[]; lessons: TableSources['lessons']; payments: PaymentRow[]; subs: SubscriptionRow[] }, src: TableSources, period: Range): Money {
  const names = new Map(src.groups.map((g) => [g.id, g.name] as const));
  const months = clubMonths({ attendances: own.atts, lessons: own.lessons, payments: own.payments, groupNames: names, startDate: src.startDate })
    .filter((m) => m.month >= monthOf(period.from) && m.month <= monthOf(period.to));
  const school = own.subs.filter((s) => !s.cancelled && s.price !== null && inRange(s.startsOn, period));
  const due = sumMoney([...months.map((m) => m.due), ...school.map((s) => s.price as number)]);
  const paid = sumMoney([...months.map((m) => m.paid), ...school.map((s) => livePaid(own.payments, s.id))]);
  return { due, paid, left: sumMoney([due, -paid]) };
}

/** The one current abonament: started, active, in use order (the 11-3 rule). */
function currentOf(subs: SubscriptionRow[], used: Map<string, number>, today: string): { sub: SubscriptionRow; used: number } | null {
  const active = subs.filter((s) => s.startsOn <= today && subscriptionState(s, used.get(s.id) ?? 0, today) === 'activ').sort(byUseOrder);
  return active[0] ? { sub: active[0], used: used.get(active[0].id) ?? 0 } : null;
}

const abonamentText = (c: { sub: SubscriptionRow; used: number } | null): string | null =>
  c === null ? null : `${c.sub.code ? `${c.sub.code} ` : ''}${c.used}/${c.sub.slots}`;

function personCells(a: AthleteRow, i: GroupInfo, acs: string, today: string): Record<string, CellValue> {
  const birth = partsFromIso(a.birthDate);
  const todayParts = partsFromIso(today);
  return {
    sportiv: a.name ?? '', varsta: todayParts ? ageFromIso(a.birthDate, todayParts) : null, dataNasterii: birth ? isoDate(birth) : null,
    grupa: i.main?.name ?? null, grupe: i.groups.map((g) => g.name).join(', ') || null, sectiune: i.section?.name ?? null, antrenor: coachText(i) || null,
    parinte: a.contactName, telefon: a.phone, email: a.email, membruAcs: acs, stare: STATUS_WORDS[a.status],
  };
}

type Own = { atts: Map<string, AttendanceRow[]>; lessons: Map<string, TableSources['lessons']>; payments: Map<string, PaymentRow[]>; subs: Map<string, SubscriptionRow[]> };

function rowOf(a: AthleteRow, i: GroupInfo, src: TableSources, own: Own, ctx: { period: Range; today: string; used: Map<string, number>; acs: Map<string, string> }): TableRow {
  const mine = { atts: own.atts.get(a.id) ?? [], lessons: own.lessons.get(a.id) ?? [], payments: own.payments.get(a.id) ?? [], subs: own.subs.get(a.id) ?? [] };
  const money = moneyOf(a, mine, src, ctx.period);
  const current = currentOf(mine.subs, ctx.used, ctx.today);
  const cells: Record<string, CellValue> = {
    ...personCells(a, i, ctx.acs.get(a.id) ?? acsWord(undefined), ctx.today),
    abonament: abonamentText(current), expira: current?.sub.validUntil ?? null, prezente: mine.atts.filter((x) => inRange(x.sessionDate, ctx.period)).length,
    dePlatit: money.due, platit: money.paid, ramas: money.left, starePlata: paymentState(money),
  };
  return { athleteId: a.id, groupKeys: mainKeys(i), cells };
}

/** One row per athlete with a current membership in the scope; every column is filled, the query picks the chosen ones. */
export function sportiviRows(src: TableSources, _d: TableDefinition, period: Range, today: string): TableRow[] {
  if (src.season === null) return [];
  const info = groupInfoMap(src);
  const own: Own = {
    atts: groupBy(src.attendances, (r) => r.athleteId), lessons: groupBy(src.lessons, (r) => r.athleteId),
    payments: groupBy(src.payments, (r) => r.athleteId), subs: groupBy(src.subscriptions, (r) => r.athleteId),
  };
  const acs = new Map(src.acs.map((r) => [r.athleteId, acsWord(effectiveAcs(r.state))] as const));
  const ctx = { period, today, used: usedSlots(src.attendances), acs };
  return src.athletes.filter((a) => src.scopeAthleteIds.has(a.id)).map((a) => rowOf(a, infoOf(info, a.id), src, own, ctx))
    .sort((x, y) => String(x.cells.sportiv).localeCompare(String(y.cells.sportiv), 'ro') || String(x.athleteId).localeCompare(String(y.athleteId)));
}
