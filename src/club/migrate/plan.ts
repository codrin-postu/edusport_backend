import { normalizeSeasonLabel } from '../season';
import { CANONICAL_GROUPS, CANONICAL_PRICE_LISTS } from './canonical';
import { nameKey, parsePrice, splitPersonName } from './names';

export function planSeasons(input: {
  registrationSeasons: (string | null)[];
  settings: { currentSeason?: string; seasonStartDate?: string; seasonEndDate?: string };
  memberFee: number | null;
  existing: string[];
}) {
  const current = normalizeSeasonLabel(input.settings.currentSeason ?? null);
  const labels = new Set<string>();
  for (const raw of [...input.registrationSeasons, input.settings.currentSeason ?? null]) {
    const label = normalizeSeasonLabel(raw);
    if (label) labels.add(label);
  }
  const existing = new Set(input.existing);
  const create = [...labels]
    .filter((label) => !existing.has(label))
    .sort()
    .map((label) => {
      const start = Number(label.slice(0, 4));
      const isCurrent = label === current;
      const hasDates = isCurrent && !!input.settings.seasonStartDate && !!input.settings.seasonEndDate;
      return {
        label,
        startMonth: hasDates ? input.settings.seasonStartDate! : `${start}-10-01`,
        endMonth: hasDates ? input.settings.seasonEndDate! : `${start + 1}-05-31`,
        membershipFee: isCurrent ? input.memberFee : null,
        isCurrent,
        needsReview: !hasDates,
      };
    });
  return { create };
}

export function planGroups(input: {
  seriesCourses: string[];
  coachGroups: { coachId: string; groups: string[] }[];
  existing: string[];
}) {
  const canonicalByKey = new Map(CANONICAL_GROUPS.map((g) => [nameKey(g.name), g]));
  const existingKeys = new Set(input.existing.map(nameKey));
  const coachesByKey = new Map<string, string[]>();
  const unknown: string[] = [];
  for (const raw of input.seriesCourses) {
    if (!canonicalByKey.has(nameKey(raw)) && !unknown.includes(raw.trim())) unknown.push(raw.trim());
  }
  for (const { coachId, groups } of input.coachGroups) {
    for (const raw of groups) {
      const key = nameKey(raw);
      if (!canonicalByKey.has(key)) {
        if (!unknown.includes(raw.trim())) unknown.push(raw.trim());
        continue;
      }
      coachesByKey.set(key, [...(coachesByKey.get(key) ?? []), coachId]);
    }
  }
  const create = CANONICAL_GROUPS.filter((g) => !existingKeys.has(nameKey(g.name))).map((g) => ({
    name: g.name,
    sectionKind: g.sectionKind,
    priceList: g.priceList,
    coachIds: coachesByKey.get(nameKey(g.name)) ?? [],
  }));
  return { create, unknown };
}

type ItemKind = 'subscription' | 'session' | 'individual';

function classify(label: string): { kind: ItemKind; sessions: number | null } | null {
  const key = nameKey(label);
  if (key.includes('individual')) return { kind: 'individual', sessions: null };
  const sessions = /(\d+)\s*sedint/.exec(key);
  if (key.includes('abonament') && sessions) return { kind: 'subscription', sessions: Number(sessions[1]) };
  if (/^1\s*sedint/.test(key)) return { kind: 'session', sessions: null };
  return null;
}

export function planPriceLists(input: {
  memberTiers: { label: string; price: unknown }[];
  nonMemberTiers: { label: string; price: unknown }[];
  existing: string[];
}) {
  const labels = new Map<string, string>();
  for (const t of [...input.memberTiers, ...input.nonMemberTiers]) labels.set(nameKey(t.label), t.label.trim());
  const priceOf = (tiers: { label: string; price: unknown }[], key: string) =>
    parsePrice(tiers.find((t) => nameKey(t.label) === key)?.price);
  const lists = new Map<string, { name: string; kind: ItemKind; sessions: number | null; memberPrice: number | null; nonMemberPrice: number | null }[]>(
    CANONICAL_PRICE_LISTS.map((n) => [n, []]),
  );
  const unmatched: string[] = [];
  for (const [key, label] of labels) {
    const c = classify(label);
    if (!c) {
      unmatched.push(label);
      continue;
    }
    const list = key.includes('gold') ? 'Avansați Gold' : 'Standard';
    lists.get(list)!.push({
      name: label,
      kind: c.kind,
      sessions: c.sessions,
      memberPrice: priceOf(input.memberTiers, key),
      nonMemberPrice: priceOf(input.nonMemberTiers, key),
    });
  }
  const existing = new Set(input.existing);
  const create = [...lists.entries()]
    .filter(([name]) => !existing.has(name))
    .map(([name, items]) => ({ name, items }));
  return { create, unmatched };
}

export function planAthletes(input: { sportspeople: { documentId: string; name: string }[]; linkedProfileIds: string[] }) {
  const linked = new Set(input.linkedProfileIds);
  const create = input.sportspeople
    .filter((p) => !linked.has(p.documentId))
    .map((p) => ({ ...splitPersonName(p.name), publicProfileId: p.documentId, dataIncomplete: true as const }));
  return { create };
}
