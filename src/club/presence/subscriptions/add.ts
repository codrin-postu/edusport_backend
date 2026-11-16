import { guarded, refuse, type AdminResult } from '../../admin-result';
import { safely } from '../../athletes/matches';
import type { AthleteRow } from '../../athletes/store';
import { done, type ActionResult, type Line } from '../../groups/action-log';
import { isIsoDate } from '../../groups/dates';
import type { SeasonRecord } from '../../groups/types';
import { isRecord } from '../../narrow';
import { SUBSCRIPTION_KEY, formatSubscriptionCode } from '../../codes';
import { isAnonymized } from '../../personal-data/anonymize-plan';
import type { Audience } from '../../price-item';
import { SUBJECT } from '../../subjects';
import { subscriptionValidUntil } from '../../subscription';
import { guardOf, recordPresenceAction } from '../action-log';
import { mainGroupOn } from '../attendance/roster';
import { audienceFor } from '../billing';
import type { PresenceContext } from '../context';
import { METHOD_WORDS, PRESENCE_ERRORS } from '../copy/core';
import { seasonOfDate } from '../dates';
import { P5_ACTIONS } from '../history-lines';
import { actorName } from '../lessons/create';
import { currentAcs, moveAcs, overpayRefusal, paymentGuards } from '../payments/common';
import { writePaymentLocked } from '../payments/record';
import { feeLeft, overpayText, readAmount, type Checked } from '../payments/rules';
import type { PresenceStore } from '../store';
import type { AttendanceRow, PaymentMethod, PriceListRecord, SubscriptionRow, SubscriptionWrite } from '../types';
import { acsGuardId, type PresenceGuard, type PresenceUndoStep } from '../undo';
import {
  checkCover, coverCandidates, formSubscriptionItems, listsForAthlete, offeredSubscriptionItems, schoolListIds, subscriptionWrite, type CoverRow, type OfferedItem,
} from './rules';

import type { AddSubscriptionResult, NewSubscriptionForm } from './views';
export type { AddSubscriptionResult, NewSubscriptionForm } from './views';
type PaymentBody = { amount: number; method: PaymentMethod; collectedAtRink: boolean; sendEmail: boolean };
type AddBody = { itemKey: string; priceListId: string; startsOn: string; cover: string[]; payment: PaymentBody | null; member: boolean | null; addFee: boolean };
type Offer = { season: SeasonRecord; audience: Audience; wasMember: boolean; lists: { list: PriceListRecord; items: OfferedItem[] }[] };

const DUPLICATE_WINDOW_MS = 10_000;
const invalid = { ok: false, status: 400, error: PRESENCE_ERRORS.invalid } as const;
const hasEmail = (a: AthleteRow): boolean => Boolean(a.email && a.email.trim() !== '');

async function mainSchoolListId(store: PresenceStore, athleteId: string, seasonId: string, startsOn: string, schoolIds: Set<string>): Promise<string | null> {
  const groupId = mainGroupOn(await store.memberships({ athleteId }), athleteId, seasonId, startsOn);
  const listId = groupId ? ((await store.group(groupId))?.priceListId ?? null) : null;
  return listId !== null && schoolIds.has(listId) ? listId : null;
}

/** What the athlete may be sold from `startsOn`: the audience price (the A.C.S. box when sent, else the season's A.C.S. state), the main school group's list (4.9). Null: no season. */
async function offerOn(store: PresenceStore, athleteId: string, startsOn: string, member: boolean | null = null): Promise<Offer | null> {
  const season = seasonOfDate(await store.seasons(), startsOn);
  if (!season) return null;
  const records = await store.priceListRecords();
  const schoolIds = schoolListIds(records, await store.sections());
  const acs = await store.acsRows({ athleteId });
  const wasMember = audienceFor(acs, athleteId, season.id) === 'member';
  const audience: Audience = (member ?? wasMember) ? 'member' : 'nonMember';
  const lists = listsForAthlete(records, schoolIds, await mainSchoolListId(store, athleteId, season.id, startsOn, schoolIds));
  return { season, audience, wasMember, lists: lists.map((list) => ({ list, items: offeredSubscriptionItems(list, audience) })) };
}

export async function newSubscriptionForm(store: PresenceStore, athleteId: string, startsOn: string | null, today: string): Promise<AdminResult<NewSubscriptionForm>> {
  const date = startsOn ?? today;
  if (!isIsoDate(date)) return refuse(400, PRESENCE_ERRORS.invalid);
  const athlete = await store.athlete(athleteId);
  if (!athlete) return refuse(404, PRESENCE_ERRORS.notFound);
  const offer = await offerOn(store, athleteId, date);
  if (!offer) return refuse(400, PRESENCE_ERRORS.invalid);
  return {
    ok: true,
    data: {
      athleteName: athlete.name ?? '', hasEmail: hasEmail(athlete), member: offer.wasMember, seasonLabel: offer.season.label, fee: await feeRemaining(store, athleteId, offer.season),
      startsOn: date, validUntil: subscriptionValidUntil(date, 0),
      lists: offer.lists.map((l) => ({ priceListId: l.list.id, listName: l.list.name, items: formSubscriptionItems(l.list) })),
      cover: coverCandidates(await store.attendances({ athleteId }), await store.groups()),
    },
  };
}

function readPayment(v: unknown): Checked<PaymentBody | null> {
  if (v === undefined || v === null) return { ok: true, value: null };
  if (!isRecord(v) || typeof v.method !== 'string' || !Object.keys(METHOD_WORDS).includes(v.method)) return invalid;
  const amount = readAmount(v.amount);
  if (amount.ok === false) return amount;
  return { ok: true, value: { amount: amount.value, method: v.method as PaymentMethod, collectedAtRink: v.collectedAtRink === true, sendEmail: v.sendEmail === true } };
}

const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/** The A.C.S. box (absent: the season's own state) and the fee box; anything but a boolean is refused (null). */
function readFlags(body: Record<string, unknown>): Pick<AddBody, 'member' | 'addFee'> | null {
  const { member, addFee } = body;
  if ((member !== undefined && typeof member !== 'boolean') || (addFee !== undefined && typeof addFee !== 'boolean')) return null;
  return { member: typeof member === 'boolean' ? member : null, addFee: addFee === true };
}

function readAddBody(body: unknown): Checked<AddBody> {
  if (!isRecord(body) || !isText(body.itemKey) || !isText(body.priceListId)) return invalid;
  if (typeof body.startsOn !== 'string' || !isIsoDate(body.startsOn)) return invalid;
  if (!Array.isArray(body.cover) || !body.cover.every(isText)) return invalid;
  const payment = readPayment(body.payment);
  if (payment.ok === false) return payment;
  const flags = readFlags(body);
  if (flags === null) return invalid;
  return { ok: true, value: { itemKey: body.itemKey, priceListId: body.priceListId, startsOn: body.startsOn, cover: body.cover as string[], payment: payment.value, ...flags } };
}

const pickItem = (offer: Offer, b: AddBody): OfferedItem | null =>
  offer.lists.find((l) => l.list.id === b.priceListId)?.items.find((i) => i.itemKey === b.itemKey) ?? null;

/** The same abonament added again within 10 s by the same admin (decided 1): a double click. */
async function findDuplicate(ctx: PresenceContext, row: SubscriptionWrite): Promise<SubscriptionRow | null> {
  const nowMs = ctx.now().getTime();
  const same = (await ctx.store.subscriptions({ athleteId: row.athleteId })).filter((s) =>
    !s.cancelled && s.itemName === row.itemName && s.priceListId === row.priceListId && s.startsOn === row.startsOn && s.recordedBy === row.recordedBy
    && nowMs - Date.parse(s.purchasedAt) < DUPLICATE_WINDOW_MS);
  return same[0] ?? null;
}

/** The rows chosen must be this athlete's "Fără abonament" rows of the list, no more than the slots, read after the lock. */
async function coverAllowed(store: PresenceStore, athleteId: string, b: AddBody, item: OfferedItem): Promise<boolean> {
  const rows: AttendanceRow[] = await store.attendances({ athleteId });
  return checkCover(b.cover, coverCandidates(rows, await store.groups()), item.priceListId, item.slots);
}

const addedChanges = (row: SubscriptionWrite, covered: number, code: string): Record<string, unknown> =>
  ({ itemName: row.itemName, startsOn: row.startsOn, validUntil: row.validUntil, covered, code });

const addedLines = (athleteId: string, id: string, row: SubscriptionWrite, covered: number, code: string): Line[] => [
  { subjectType: SUBJECT.athlete, subjectId: athleteId, action: P5_ACTIONS.subscriptionAdded, changes: addedChanges(row, covered, code) },
  { subjectType: SUBJECT.subscription, subjectId: id, action: P5_ACTIONS.subscriptionAdded, changes: addedChanges(row, covered, code) },
];

async function cover(store: PresenceStore, id: string, rowIds: string[]): Promise<PresenceUndoStep[]> {
  for (const rowId of rowIds) await store.updateAttendance(rowId, { subscriptionId: id, billing: 'slot' });
  return rowIds.map((rowId) => ({ op: 'setAttendanceSlot', id: rowId, subscriptionId: null, billing: 'fara_abonament' }));
}

type Paid = { lines: Line[]; steps: PresenceUndoStep[]; paymentId: string; emailQueued: boolean };

/** The optional payment, written by the payment writer (T4) dated today for this abonament; the subscription was written just before. */
async function writePayment(ctx: PresenceContext, athlete: AthleteRow, id: string, p: PaymentBody): Promise<Paid> {
  const input = { amount: p.amount, paidOn: ctx.today, method: p.method, for: { kind: 'abonament' as const, subscriptionId: id }, collectedAtRink: p.collectedAtRink, note: null };
  const written = await writePaymentLocked(ctx, { athlete, input, sendEmail: p.sendEmail });
  if (written.ok === false) throw new Error(`payment refused after the abonament was written: ${written.error}`);
  const w = written.data;
  return { lines: w.lines, steps: w.steps, paymentId: w.paymentId, emailQueued: w.emailQueued };
}

/** Everything a refusal can come from is checked before the first write: a refusal after one would still be committed. */
async function paymentRefusal(ctx: PresenceContext, athlete: AthleteRow, p: PaymentBody | null, item: OfferedItem): Promise<string | null> {
  if (p === null) return null;
  if (p.sendEmail && !hasEmail(athlete)) return PRESENCE_ERRORS.invalid;
  if (seasonOfDate(await ctx.store.seasons(), ctx.today) === null) return PRESENCE_ERRORS.invalid;
  return overpayText(p.amount, item.price);
}

/** What is still owed of the season fee (the fee less its live payments); 0 or null: nothing to collect. */
async function feeRemaining(store: PresenceStore, athleteId: string, season: SeasonRecord): Promise<number | null> {
  return feeLeft(season, await store.payments({ athleteId }));
}

/**
 * The fee box asked for: only with membership turning on and a payment recorded now. The amount is the rest of the season fee, worked out here
 * (never taken from the client). Null when it does not apply or nothing is left. Read before the first write.
 */
async function feeToCollect(ctx: PresenceContext, athleteId: string, offer: Offer, b: AddBody): Promise<number | null> {
  if (!b.addFee || b.member !== true || offer.wasMember || b.payment === null) return null;
  const left = await feeRemaining(ctx.store, athleteId, offer.season);
  return left !== null && left > 0 ? left : null;
}

/** The box turning membership on writes A.C.S. "Da" through the payments' own writer (`moveAcs`), with its Istoric line and undo step; never turns it off. */
async function turnMembershipOn(ctx: PresenceContext, athleteId: string, offer: Offer, b: AddBody): Promise<{ lines: Line[]; steps: PresenceUndoStep[] }> {
  if (b.member !== true || offer.wasMember) return { lines: [], steps: [] };
  const move = await moveAcs(ctx.store, athleteId, offer.season, await currentAcs(ctx.store, athleteId, offer.season.id), 'da');
  return { lines: [move.line], steps: [move.step] };
}

async function writeFee(ctx: PresenceContext, athlete: AthleteRow, offer: Offer, fee: number, p: PaymentBody): Promise<Paid> {
  const input = { amount: fee, paidOn: ctx.today, method: p.method, for: { kind: 'cotizatie' as const, seasonId: offer.season.id }, collectedAtRink: p.collectedAtRink, note: null };
  const written = await writePaymentLocked(ctx, { athlete, input, sendEmail: false });
  if (written.ok === false) throw new Error(`fee payment refused after the abonament was written: ${written.error}`);
  const w = written.data;
  return { lines: w.lines, steps: w.steps, paymentId: w.paymentId, emailQueued: false };
}

type Extra = { lines: Line[]; steps: PresenceUndoStep[]; guards: PresenceGuard[] };

/** A.C.S. turned on and the fee collected with it: the membership first, so the fee payment finds "Da" and keeps it if that payment is cancelled. */
async function membershipAndFee(ctx: PresenceContext, athlete: AthleteRow, offer: Offer, b: AddBody, fee: number | null): Promise<Extra> {
  const member = await turnMembershipOn(ctx, athlete.id, offer, b);
  const out: Extra = { ...member, guards: [] };
  if (member.steps.length > 0) out.guards.push(await guardOf(ctx.store, 'acs', acsGuardId(athlete.id, offer.season.id)));
  if (fee === null || b.payment === null) return out;
  const paid = await writeFee(ctx, athlete, offer, fee, b.payment);
  out.lines.push(...paid.lines);
  out.steps.push(...paid.steps);
  out.guards.push(...(await paymentGuards(ctx.store, paid.paymentId, paid.steps)));
  return out;
}

type Plan = { athlete: AthleteRow; offer: Offer; item: OfferedItem; row: SubscriptionWrite; fee: number | null };

/** Every write of the add, after all checks passed: abonament, covered rows, payment, A.C.S. and fee, recorded as one undoable action. */
async function writeAdd(ctx: PresenceContext, b: AddBody, { athlete, offer, row, fee }: Plan): Promise<ActionResult<AddSubscriptionResult>> {
  const athleteId = athlete.id;
  const code = formatSubscriptionCode(await ctx.store.nextCounter(SUBSCRIPTION_KEY));
  const id = await ctx.store.createSubscription(row, code);
  const steps: PresenceUndoStep[] = [{ op: 'deleteSubscription', id }, ...(await cover(ctx.store, id, b.cover))];
  const guards = [await guardOf(ctx.store, 'subscription', id)];
  const lines = addedLines(athleteId, id, row, b.cover.length, code);
  const paid = b.payment ? await writePayment(ctx, athlete, id, b.payment) : null;
  if (paid) {
    lines.push(...paid.lines);
    steps.push(...paid.steps);
    guards.push(...(await paymentGuards(ctx.store, paid.paymentId, paid.steps)));
  }
  const extra = await membershipAndFee(ctx, athlete, offer, b, fee);
  lines.push(...extra.lines);
  steps.push(...extra.steps);
  guards.push(...extra.guards);
  const actionId = await recordPresenceAction(ctx.store, ctx.actor, lines, { steps, athletes: [athleteId], guards });
  return done({ subscriptionId: id, athleteName: athlete.name ?? '', withPayment: paid !== null }, actionId);
}

async function addLocked(ctx: PresenceContext, athleteId: string, b: AddBody): Promise<ActionResult<AddSubscriptionResult>> {
  await ctx.store.lockAthlete(athleteId);
  const athlete = await ctx.store.athlete(athleteId);
  if (!athlete) return refuse(404, PRESENCE_ERRORS.notFound);
  if (isAnonymized(athlete)) return refuse(409, PRESENCE_ERRORS.stale);
  const offer = await offerOn(ctx.store, athleteId, b.startsOn, b.member);
  const item = offer ? pickItem(offer, b) : null;
  if (!offer || !item) return refuse(400, PRESENCE_ERRORS.invalid);
  const refused = await paymentRefusal(ctx, athlete, b.payment, item);
  if (refused !== null) return refuse(400, refused);
  const fee = await feeToCollect(ctx, athleteId, offer, b);
  const row = subscriptionWrite({ athleteId, seasonId: offer.season.id, item, audience: offer.audience, startsOn: b.startsOn, actor: await actorName(ctx), now: ctx.now().toISOString() });
  const same = await findDuplicate(ctx, row);
  const name = athlete.name ?? '';
  if (same) return done({ subscriptionId: same.id, athleteName: name, withPayment: false }, null);
  if (!(await coverAllowed(ctx.store, athleteId, b, item))) return refuse(409, PRESENCE_ERRORS.conflict);
  return writeAdd(ctx, b, { athlete, offer, item, row, fee });
}

/** Adds an abonament frozen at today's price, covers the chosen "Fără abonament" rows and may record the payment, as one undoable action (4.9, 5.8). */
export async function addSubscription(ctx: PresenceContext, athleteId: string, body: unknown): Promise<ActionResult<AddSubscriptionResult>> {
  const read = readAddBody(body);
  if (read.ok === false) return refuse(read.status, read.error);
  const b = read.value;
  const result = await guarded(ctx.log, `[subscription-add] ${athleteId}`, () => ctx.store.transaction(() => addLocked(ctx, athleteId, b)));
  if (result.ok && result.data.value.withPayment && b.payment?.sendEmail) await queuedEmail(ctx, athleteId, result.data.value.subscriptionId);
  return result;
}

async function queuedEmail(ctx: PresenceContext, athleteId: string, subscriptionId: string): Promise<void> {
  const payment = (await ctx.store.payments({ athleteId, subscriptionId })).find((p) => !p.cancelled && p.emailJobId !== null);
  if (payment) await safely(async () => ctx.paymentEmails(payment.id), ctx.log, 'payment e-mail attempt');
}
