import { METHOD_WORDS } from '../presence/copy/core';
import { monthOf, monthTitle } from '../presence/dates';
import { listPurposeText } from '../presence/payments/rules';
import { CANCELLED_WORD, YES_NO } from './catalog';
import { groupInfoMap, infoOf, mainKeys, nameOf } from './context';
import type { TableSources } from './sources';
import type { CellValue, TableDefinition, TableRow } from './types';

type Range = { from: string; to: string };

/** One row per payment with `paidOn` in the period, cancelled ones included; "Grupă" is the athlete's main group in the scope season. */
export function platiRows(src: TableSources, _d: TableDefinition, period: Range): TableRow[] {
  if (src.season === null) return [];
  const info = groupInfoMap(src);
  const names = nameOf(src);
  const subs = new Map(src.subscriptions.map((s) => [s.id, s] as const));
  const seasons = new Map(src.seasons.map((s) => [s.id, s.label] as const));
  return src.payments.filter((p) => period.from <= p.paidOn && p.paidOn <= period.to)
    .sort((a, b) => a.paidOn.localeCompare(b.paidOn) || String(a.receiptNo).localeCompare(String(b.receiptNo)) || a.id.localeCompare(b.id))
    .map((p): TableRow => {
      const i = infoOf(info, p.athleteId);
      const sub = p.subscriptionId === null ? undefined : subs.get(p.subscriptionId);
      const cells: Record<string, CellValue> = {
        data: p.paidOn, nrChitanta: p.receiptNo, sportiv: names.get(p.athleteId) ?? '', grupa: i.main?.name ?? null, sectiune: i.section?.name ?? null,
        pentru: listPurposeText(p, { itemName: sub?.itemName ?? null, startsOn: sub?.startsOn ?? null, code: sub?.code ?? null, seasonLabel: seasons.get(p.seasonId) ?? null }),
        metoda: METHOD_WORDS[p.method], laPatinoar: p.collectedAtRink ? YES_NO[0] : YES_NO[1], suma: p.amount,
        inregistratDe: src.adminNames[p.recordedBy] ?? p.recordedBy, stare: p.cancelled ? CANCELLED_WORD : null, nota: p.note,
      };
      const month = monthOf(p.paidOn);
      return { athleteId: p.athleteId, groupKeys: { ...mainKeys(i), luna: [{ key: month, label: monthTitle(month) }] }, cells };
    });
}
