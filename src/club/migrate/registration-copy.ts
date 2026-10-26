import type { CurrentSeason } from '../current-season';
import { asText, asTextList } from '../narrow';
import { normalizeSeasonLabel } from '../season';
import { nameKey, parsePrice } from './names';

export type LegacyTier = { label?: unknown; price?: unknown; tooltip?: unknown; note?: unknown };
export type LegacyTiers = { memberTiers?: LegacyTier[]; nonMemberTiers?: LegacyTier[]; memberFeePrice?: unknown };
export type ItemForCopy = { name: string; tooltip?: string | null } & Record<string, unknown>;
export type PriceListForCopy = { documentId: string; name: string; items: ItemForCopy[] };
export type TooltipUpdate = { documentId: string; name: string; items: ItemForCopy[]; filled: string[] };
export type TooltipPlan = { updates: TooltipUpdate[]; unmatched: string[]; droppedNotes: string[]; conflicts: string[] };
export type SectionForNotes = { documentId: string; name: string; kind?: unknown; priceNotes?: unknown };
export type LegacySeasonSettings = { currentSeason?: unknown; seasonStartDate?: unknown; seasonEndDate?: unknown };
export type SectionForPage = { documentId: string; name: string; kind?: unknown; publicPage?: unknown };

type TooltipSource = { text: string; label: string };
type Collected = { byKey: Map<string, TooltipSource>; droppedNotes: string[]; conflicts: string[] };

/** A tier's tooltip, or its note when it has none ("notes become tooltips"). */
function tierText(t: LegacyTier, droppedNotes: string[]): string {
  const tooltip = asText(t.tooltip);
  const note = asText(t.note);
  if (tooltip && note) droppedNotes.push(`${asText(t.label)}: ${note}`);
  return tooltip || note;
}

function collectTooltips(tiers: LegacyTiers): Collected {
  const out: Collected = { byKey: new Map(), droppedNotes: [], conflicts: [] };
  for (const t of [...(tiers.memberTiers ?? []), ...(tiers.nonMemberTiers ?? [])]) {
    const label = asText(t.label);
    const text = tierText(t, out.droppedNotes);
    if (!label || !text) continue;
    const prev = out.byKey.get(nameKey(label));
    if (prev && prev.text !== text) out.conflicts.push(label);
    if (!prev) out.byKey.set(nameKey(label), { text, label });
  }
  return out;
}

function fillList(list: PriceListForCopy, byKey: Map<string, TooltipSource>, used: Set<string>): TooltipUpdate | null {
  const filled: string[] = [];
  const items = list.items.map((item) => {
    const key = nameKey(item.name);
    const source = byKey.get(key);
    if (source) used.add(key);
    if (!source || asText(item.tooltip)) return item;
    filled.push(item.name);
    return { ...item, tooltip: source.text };
  });
  return filled.length ? { documentId: list.documentId, name: list.name, items, filled } : null;
}

export function planTooltipCopy(input: { tiers: LegacyTiers; lists: PriceListForCopy[] }): TooltipPlan {
  const { byKey, droppedNotes, conflicts } = collectTooltips(input.tiers);
  const used = new Set<string>();
  const updates = input.lists
    .map((list) => fillList(list, byKey, used))
    .filter((u): u is TooltipUpdate => u !== null);
  const unmatched = [...byKey.entries()].filter(([key]) => !used.has(key)).map(([, source]) => source.label);
  return { updates, unmatched, droppedNotes, conflicts };
}

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** pricing.footerNotes onto the school section's priceNotes, only when those are empty. */
export function planPriceNotesCopy(input: { footerNotes: unknown; sections: SectionForNotes[] }): {
  update: { documentId: string; priceNotes: string[] } | null;
  report: string[];
} {
  const notes = asTextList(input.footerNotes);
  if (notes.length === 0) return { update: null, report: [] };
  const schools = input.sections.filter((s) => s.kind === 'school');
  if (schools.length !== 1) return { update: null, report: [`expected one school section, found ${schools.length}; price notes not copied`] };
  const [school] = schools;
  const current = asTextList(school.priceNotes);
  if (current.length === 0) return { update: { documentId: school.documentId, priceNotes: notes }, report: [] };
  if (sameList(current, notes)) return { update: null, report: [] };
  return { update: null, report: [`${school.name}: price notes already set and different; not overwritten`] };
}

/** The school section becomes the registration target and appears in the public read (user ruling, 2026-10-19). */
export function planSchoolPublicPage(sections: SectionForPage[]): {
  update: { documentId: string; name: string } | null;
  report: string[];
} {
  const schools = sections.filter((s) => s.kind === 'school');
  if (schools.length !== 1) return { update: null, report: [`expected one school section, found ${schools.length}; publicPage not set`] };
  const [school] = schools;
  return school.publicPage === true ? { update: null, report: [] } : { update: { documentId: school.documentId, name: school.name }, report: [] };
}

type CustomLike = { key?: unknown; label?: unknown };

function customQuestions(overlay: unknown): CustomLike[] {
  const custom = overlay && typeof overlay === 'object' ? (overlay as { custom?: unknown }).custom : undefined;
  return Array.isArray(custom) ? custom : [];
}

function withoutKeys(order: unknown, keys: Set<string>): unknown {
  if (!order || typeof order !== 'object') return order;
  return Object.fromEntries(
    Object.entries(order).map(([step, list]) => [step, Array.isArray(list) ? list.filter((k) => !keys.has(k)) : list]),
  );
}

/** The `inscriere` overlay without its custom (CMS-added) questions (user decision, 2026-10-03). Null: nothing to do. */
export function planCustomQuestionRemoval(overlay: unknown): { removed: string[]; overlay: Record<string, unknown> | null } {
  const custom = customQuestions(overlay);
  if (custom.length === 0) return { removed: [], overlay: null };
  const keys = new Set(custom.map((c) => asText(c.key)));
  const next: Record<string, unknown> = { ...(overlay as Record<string, unknown>) };
  delete next.custom;
  if ('order' in next) next.order = withoutKeys(next.order, keys);
  return { removed: custom.map((c) => asText(c.label) || asText(c.key)), overlay: next };
}

function monthDiff(which: string, sezon: string, legacy: unknown): string[] {
  const old = asText(legacy).slice(0, 7);
  const now = sezon.slice(0, 7);
  return old && old !== now ? [`${which} month: Sezon ${now}, settings ${old}`] : [];
}

/** Season period and fee from the old settings compared with the current Sezon. Reported, never written. */
export function checkSeasonAgainstLegacy(input: {
  season: CurrentSeason | null;
  settings: LegacySeasonSettings;
  memberFeePrice: unknown;
}): string[] {
  const { season, settings } = input;
  if (!season) return ['no current Sezon: registrations will be refused'];
  const diffs: string[] = [];
  const label = normalizeSeasonLabel(asText(settings.currentSeason));
  if (label && label !== season.label) diffs.push(`season: Sezon ${season.label}, settings ${label}`);
  diffs.push(...monthDiff('start', season.startMonth, settings.seasonStartDate));
  diffs.push(...monthDiff('end', season.endMonth, settings.seasonEndDate));
  const fee = parsePrice(input.memberFeePrice);
  if (fee !== null && fee !== season.membershipFee) diffs.push(`membership fee: Sezon ${season.membershipFee ?? 'empty'}, pricing ${fee}`);
  return diffs;
}
