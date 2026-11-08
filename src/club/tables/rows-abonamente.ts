import { monthOf, monthTitle } from '../presence/dates';
import { SUBSCRIPTION_STATE_WORDS } from '../presence/copy/core';
import { sumMoney } from '../presence/money';
import { subscriptionState, usedSlots } from '../presence/subscriptions';
import { groupInfoMap, infoOf, mainKeys, nameOf } from './context';
import { inRange, inScope, type TableSources } from './sources';
import type { CellValue, TableDefinition, TableRow } from './types';

type Range = { from: string; to: string };

/** One row per abonament with `startsOn` in the period; Preț, Plătit and Rămas from its non-cancelled payments (a cancelled abonament owes nothing). */
export function abonamenteRows(src: TableSources, _d: TableDefinition, period: Range, today: string): TableRow[] {
  if (src.season === null) return [];
  const info = groupInfoMap(src);
  const names = nameOf(src);
  const used = usedSlots(src.attendances);
  const paidOf = new Map<string, number[]>();
  for (const p of src.payments) {
    if (!p.cancelled && p.purpose === 'abonament' && p.subscriptionId !== null) paidOf.set(p.subscriptionId, [...(paidOf.get(p.subscriptionId) ?? []), p.amount]);
  }
  return src.subscriptions.filter((s) => inScope(src, s.athleteId) && inRange(s.startsOn, period))
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn) || String(a.code).localeCompare(String(b.code)) || a.id.localeCompare(b.id))
    .map((s): TableRow => {
      const i = infoOf(info, s.athleteId);
      const count = used.get(s.id) ?? 0;
      const paid = sumMoney(paidOf.get(s.id) ?? []);
      const cells: Record<string, CellValue> = {
        cod: s.code, sportiv: names.get(s.athleteId) ?? '', grupa: i.main?.name ?? null, abonament: s.itemName, inceput: s.startsOn, expira: s.validUntil,
        folosite: count, pret: s.price, platit: paid, ramas: s.cancelled || s.price === null ? 0 : sumMoney([s.price, -paid]),
        stare: SUBSCRIPTION_STATE_WORDS[subscriptionState(s, count, today)],
      };
      const month = monthOf(s.startsOn);
      return { athleteId: s.athleteId, groupKeys: { ...mainKeys(i), luna: [{ key: month, label: monthTitle(month) }] }, cells };
    });
}
