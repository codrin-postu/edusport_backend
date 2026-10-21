import type { CurrentSeason } from './current-season';
import { asText, asTextList } from './narrow';
import { isIncomplete, isPrice, isPriceItemKind, offeredItems, priceFor, type Audience, type PriceItemKind } from './price-item';

export type PublicPriceItem = {
  name: string;
  kind: PriceItemKind;
  sessions: number | null;
  memberPrice: number | null;
  nonMemberPrice: number | null;
  tooltip: string | null;
};
export type PublicPriceList = { name: string; items: PublicPriceItem[] };
export type PublicSchool = { name: string; slug: string; priceLists: PublicPriceList[]; priceNotes: string[] };
export type PublicSeason = { label: string; startMonth: string; endMonth: string };
export type PublicClubInfo = { season: PublicSeason | null; membershipFee: number | null; schools: PublicSchool[] };
/** Frozen on the registration at submit (spec 1.1). */
export type SubscriptionChoice = { priceItemName: string; price: number; member: boolean };

export type RawPriceItem = { name?: unknown; kind?: unknown; sessions?: unknown; memberPrice?: unknown; nonMemberPrice?: unknown; tooltip?: unknown };
export type RawPriceList = { name?: unknown; section?: { documentId?: unknown } | null; items?: unknown };
export type RawSection = {
  documentId?: unknown;
  name?: unknown;
  slug?: unknown;
  kind?: unknown;
  publicPage?: unknown;
  order?: unknown;
  priceNotes?: unknown;
};

/** The public view of one price item, or null when it has no usable name, kind or any price. */
export function toPublicItem(raw: RawPriceItem): PublicPriceItem | null {
  const name = asText(raw.name);
  if (!name || !isPriceItemKind(raw.kind)) return null;
  const item: PublicPriceItem = {
    name,
    kind: raw.kind,
    sessions: typeof raw.sessions === 'number' && Number.isInteger(raw.sessions) ? raw.sessions : null,
    memberPrice: isPrice(raw.memberPrice) ? raw.memberPrice : null,
    nonMemberPrice: isPrice(raw.nonMemberPrice) ? raw.nonMemberPrice : null,
    tooltip: asText(raw.tooltip) || null,
  };
  return isIncomplete(item) ? null : item;
}

function publicItems(items: unknown): PublicPriceItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((raw: RawPriceItem) => toPublicItem(raw)).filter((i): i is PublicPriceItem => i !== null);
}

/** Every list of each section, in the order given, with its priced items; lists left empty are dropped. */
function listsBySection(lists: RawPriceList[]): Map<string, PublicPriceList[]> {
  const out = new Map<string, PublicPriceList[]>();
  for (const list of lists) {
    const sectionId = list.section?.documentId;
    const items = publicItems(list.items);
    if (typeof sectionId !== 'string' || items.length === 0) continue;
    out.set(sectionId, [...(out.get(sectionId) ?? []), { name: asText(list.name), items }]);
  }
  return out;
}

const sectionRank = (s: RawSection) => (typeof s.order === 'number' ? s.order : Number.MAX_SAFE_INTEGER);

function bySectionOrder(a: RawSection, b: RawSection): number {
  return sectionRank(a) - sectionRank(b) || asText(a.name).localeCompare(asText(b.name), 'ro');
}

/** Website and form schools: `kind = 'school'` with a public page. Club never, even with a public page. */
const isPublicSchool = (s: RawSection) => s.kind === 'school' && s.publicPage === true;

function toPublicSchool(s: RawSection, lists: Map<string, PublicPriceList[]>): PublicSchool | null {
  const name = asText(s.name);
  const slug = asText(s.slug);
  if (typeof s.documentId !== 'string' || !name || !slug) return null;
  const priceLists = lists.get(s.documentId) ?? [];
  return { name, slug, priceLists, priceNotes: asTextList(s.priceNotes) };
}

export function buildPublicSchools(sections: RawSection[], lists: RawPriceList[]): PublicSchool[] {
  const bySection = listsBySection(lists);
  return sections
    .filter(isPublicSchool)
    .sort(bySectionOrder)
    .map((s) => toPublicSchool(s, bySection))
    .filter((s): s is PublicSchool => s !== null);
}

export function buildPublicClubInfo(season: CurrentSeason | null, schools: PublicSchool[]): PublicClubInfo {
  return {
    season: season ? { label: season.label, startMonth: season.startMonth, endMonth: season.endMonth } : null,
    membershipFee: season?.membershipFee ?? null,
    schools,
  };
}

/** The chosen item with its price for this audience, from the server's lists; null when not offered. */
export function resolveSubscriptionChoice(school: PublicSchool, priceItemName: string, member: boolean): SubscriptionChoice | null {
  const audience: Audience = member ? 'member' : 'nonMember';
  const wanted = priceItemName.trim();
  const item = offeredItems(school.priceLists.flatMap((l) => l.items), audience).find((i) => i.name === wanted);
  const price = item ? priceFor(item, audience) : null;
  return item && price !== null ? { priceItemName: item.name, price, member } : null;
}
