import { refuse, type AdminResult } from '../../admin-result';
import { MONTHS_SHORT } from '../../groups/dates';
import { currentSeason } from '../../groups/season-pick';
import { isSafeDocumentId, listStored, readStoredDocument, registrationDir } from '../../documents/storage';
import { PRESENCE_ERRORS, PURPOSE_WORDS } from '../../presence/copy/core';
import { monthName, monthOf } from '../../presence/dates';
import { groupNameMap } from '../../presence/due/reads';
import { clubMonths, schoolDue, type ClubMonth } from '../../presence/due/settlement';
import { sumMoney } from '../../presence/money';
import type { PaymentRowView } from '../../presence/money-api';
import { onDate } from '../../presence/attendance/roster';
import { athletePayments } from '../../presence/payments/reads';
import { readAthleteSubscriptionCards } from '../../presence/subscriptions/usage';
import type { LessonRow, PaymentRow, SubscriptionRow } from '../../presence/types';
import { abonamentShort } from '../presence-facts';
import type { MoneyLine, PaymentRow as SportivPaymentRow, SportivMoney, SportivPayments, SportivSubscriptions, Ticket } from './api-types';
import type { SportivContext } from './context';
import { toMoney, toPayments, toSubscriptions } from './views';

const PAGE_SIZE = 20;

/** "12 noi" */
const dayMonth = (date: string): string => `${Number(date.slice(8, 10))} ${MONTHS_SHORT[Number(date.slice(5, 7)) - 1]}`;

const yearAgo = (today: string): string => `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`;

/** Facts `paymentWhat` needs that the admin payment view does not carry: where an abonament starts, a lesson's date, a season's label. */
export type PaymentNames = {
  subscriptionStarts?: ReadonlyMap<string, string>; lessonDates?: ReadonlyMap<string, string>; seasonLabels?: ReadonlyMap<string, string>;
};

/** What a payment was for, as the sportiv reads it: the payment note never takes part. */
export function paymentWhat(p: PaymentRowView, names: PaymentNames = {}): string {
  const f = p.for;
  switch (f.kind) {
    case 'abonament': {
      const start = names.subscriptionStarts?.get(f.subscriptionId);
      return start ? `${PURPOSE_WORDS.abonament} ${monthName(monthOf(start))}` : PURPOSE_WORDS.abonament;
    }
    case 'lectie': {
      const date = names.lessonDates?.get(f.lessonId);
      return date ? `Lecție ${dayMonth(date)}` : 'Lecție';
    }
    case 'club_luna': return `Club ${monthName(f.month)}`;
    case 'cotizatie': {
      const label = names.seasonLabels?.get(f.seasonId);
      return label ? `Cotizație ${label}` : 'Cotizație';
    }
    case 'altceva': return 'Altă plată';
  }
}

const liveFor = (payments: readonly PaymentRow[], match: (p: PaymentRow) => boolean): number =>
  sumMoney(payments.filter((p) => !p.cancelled && match(p)).map((p) => p.amount));

/** Group names of the priced charges of a month ("Club Performanță"); the month's priced groups when no line names one. */
function monthLabel(m: ClubMonth, priced: ReadonlySet<string>, names: ReadonlyMap<string, string>): string {
  const fromLines = m.lines.filter((l) => l.groupName && l.charges.some((c) => !c.included && (c.price ?? 0) > 0)).map((l) => l.groupName as string);
  const labels = [...new Set(fromLines.length > 0 ? fromLines : m.groupIds.filter((id) => priced.has(id)).map((id) => names.get(id) ?? ''))].filter((n) => n !== '');
  return `${labels.length > 0 ? labels.join(', ') : 'Club'} ${monthName(m.month)}`;
}

type Owed = { lines: MoneyLine[]; advance: number };

/**
 * What the athlete owes and what is paid ahead. Club months and Școala abonamente come from the admin ledger (`clubMonths`, `schoolDue`);
 * lessons pool with their month as in the admin Plăți tab, and attendances without a price (`inclus`, `fara_pret`, a group without a price list) take no part.
 */
async function owedOf(c: SportivContext, athleteId: string): Promise<Owed> {
  const store = c.presence.store;
  const [attendances, lessons, payments, subs, groups, startDate] = await Promise.all([
    store.attendances({ athleteId }), store.lessons({ athleteId }), store.payments({ athleteId }), store.subscriptions({ athleteId }), store.groups(), store.attendanceStartDate(),
  ]);
  const names = groupNameMap(groups);
  const priced = new Set(groups.filter((g) => g.priceListId).map((g) => g.id));
  const lines: MoneyLine[] = [];
  let advance = 0;

  const club = attendances.filter((a) => a.billing === 'club' && priced.has(a.groupId));
  const held = (l: LessonRow): boolean => l.state === 'saved' && l.present === true;
  // One pooled ledger per month, exactly as the admin Plăți tab: lessons and club payments settle together.
  for (const m of clubMonths({ attendances: club, lessons, payments, groupNames: names, startDate })) {
    if (m.left < 0) {
      advance = sumMoney([advance, -m.left]);
      continue;
    }
    if (m.left === 0) continue;
    // Lesson lines are display lines inside the month's left: each unpaid lesson, then the rest as the Club line.
    let rest = m.left;
    for (const l of lessons.filter((x) => held(x) && monthOf(x.date) === m.month).sort((x, y) => x.date.localeCompare(y.date))) {
      const own = Math.min(rest, Math.max(0, sumMoney([l.amount, -liveFor(payments, (p) => p.purpose === 'lectie' && p.lessonId === l.id)])));
      if (own > 0) lines.push({ text: `Lecție ${dayMonth(l.date)}`, amount: own });
      rest = sumMoney([rest, -own]);
    }
    if (rest > 0) lines.push({ text: monthLabel(m, priced, names), amount: rest });
  }

  for (const d of schoolDue(subs, payments)) lines.push({ text: `${PURPOSE_WORDS.abonament} Școala ${monthName(monthOf(d.startsOn))}`, amount: d.left });
  for (const s of subs.filter((x: SubscriptionRow) => !x.cancelled && x.price !== null)) {
    const over = sumMoney([liveFor(payments, (p) => p.purpose === 'abonament' && p.subscriptionId === s.id), -(s.price as number)]);
    if (over > 0) advance = sumMoney([advance, over]);
  }
  return { lines, advance };
}

/** The registration folder holding the current season's Acord, with the season label; none: null. An older season's file never counts. */
async function currentAcord(c: SportivContext, athleteId: string): Promise<{ seasonLabel: string; dir: string } | null> {
  const season = currentSeason(await c.presence.store.seasons());
  if (!season) return null;
  for (const r of await c.club.store.registrations({ athleteId })) {
    if (r.seasonId !== season.id || !isSafeDocumentId(r.id)) continue;
    const dir = registrationDir(c.documentsRoot, r.id);
    if ((await listStored(dir)).some((d) => d.kind === 'acord')) return { seasonLabel: season.label, dir };
  }
  return null;
}

/** Bani (money, spec 6.7): what is left to pay with its lines, the advance, the abonament in use (a fully used one still shows its last class) and the registration PDF. Callers check that the holder holds the athlete. */
export async function readMoney(c: SportivContext, athleteId: string): Promise<SportivMoney> {
  const store = c.presence.store;
  const season = currentSeason(await store.seasons());
  const [owed, memberships, groups, acord] = await Promise.all([
    owedOf(c, athleteId), season ? store.memberships({ athleteId, seasonId: season.id }) : Promise.resolve([]), store.groups(), currentAcord(c, athleteId),
  ]);
  const current = memberships.filter((m) => onDate(m, c.today)).sort((a, b) => Number(b.isMain) - Number(a.isMain));
  const short = await abonamentShort(store, athleteId, current.flatMap((m) => groups.filter((g) => g.id === m.groupId)), c.today, true);
  return toMoney({
    left: sumMoney(owed.lines.map((l) => l.amount)), lines: owed.lines, advance: owed.advance > 0 ? owed.advance : null,
    abonament: short ? { ...short.abonament, itemName: short.subscription.itemName, startsOn: short.subscription.startsOn } : null,
    document: acord ? { seasonLabel: acord.seasonLabel } : null,
  });
}

/** Payments, newest first, 20 a page; cancelled ones are left out. */
export async function readPayments(c: SportivContext, athleteId: string, page: number): Promise<SportivPayments> {
  const store = c.presence.store;
  const [result, subs, lessons, seasons] = await Promise.all([
    athletePayments(store, athleteId, c.today), store.subscriptions({ athleteId }), store.lessons({ athleteId }), store.seasons(),
  ]);
  if (!result) throw new Error('sportiv payments: athlete not found');
  const names: PaymentNames = {
    subscriptionStarts: new Map(subs.map((s) => [s.id, s.startsOn] as const)), lessonDates: new Map(lessons.map((l) => [l.id, l.date] as const)),
    seasonLabels: new Map(seasons.map((s) => [s.id, s.label] as const)),
  };
  const live = result.payments.filter((p) => !p.cancelled);
  const at = Math.max(1, Math.floor(page) || 1);
  const rows: SportivPaymentRow[] = live.slice((at - 1) * PAGE_SIZE, at * PAGE_SIZE).map((p) => ({ what: paymentWhat(p, names), paidOn: p.paidOn, method: p.method, amount: p.amount }));
  return toPayments({ page: at, total: live.length, rows });
}

/** Abonamente: the one in use (a fully used one valid today still counts) with the dates that used its slots, and the last 12 months of earlier ones; cancelled ones never show. */
export async function readSubscriptions(c: SportivContext, athleteId: string): Promise<SportivSubscriptions> {
  const read = await readAthleteSubscriptionCards(c.presence.store, athleteId, null, c.today);
  if (!read.ok) throw new Error('sportiv subscriptions: athlete not found');
  const { current, others } = read.data;
  const shown = current ?? others.find((o) => o.state === 'epuizat' && o.startsOn <= c.today && c.today <= o.validUntil) ?? null;
  const active: Ticket | null = shown
    ? { code: shown.code, itemName: shown.label, startsOn: shown.startsOn, validUntil: shown.validUntil, slots: shown.slots, used: shown.uses.map((u) => u.date), left: Math.max(0, shown.slots - shown.used) }
    : null;
  const since = yearAgo(c.today);
  const earlier = others.filter((o) => o !== shown && o.state !== 'anulat' && o.validUntil >= since).map((o) => ({ itemName: o.label, used: o.used, slots: o.slots, validUntil: o.validUntil }));
  return toSubscriptions({ active, earlier });
}

/** The current season's Acord PDF of the athlete; none stored: 404. */
export async function readAcord(c: SportivContext, athleteId: string): Promise<AdminResult<{ fileName: string; data: Buffer }>> {
  const found = await currentAcord(c, athleteId);
  const file = found ? await readStoredDocument(found.dir, 'acord') : null;
  return file ? { ok: true, data: file } : refuse(404, PRESENCE_ERRORS.notFound);
}
