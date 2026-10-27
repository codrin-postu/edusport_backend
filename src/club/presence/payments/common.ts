import type { AcsState } from '../../acs';
import type { Line } from '../../groups/action-log';
import type { SeasonRecord } from '../../groups/types';
import { HISTORY_ACTIONS } from '../../history-text';
import { SUBJECT } from '../../subjects';
import { guardOf, recordPresenceAction } from '../action-log';
import type { PresenceContext } from '../context';
import { seasonOfDate } from '../dates';
import type { PresenceStore } from '../store';
import type { PaymentRow, PaymentWrite } from '../types';
import { acsRevert, purposeFields, purposeText, type PaymentFor, type PurposeFields } from './rules';
import { acsGuardId, type PresenceGuard, type PresenceUndoStep } from '../undo';

type Link = Pick<PurposeFields, 'subscriptionId' | 'lessonId'>;
export type Fields = { fields: PurposeFields; season: SeasonRecord };
export type AcsMove = { line: Line; step: PresenceUndoStep };

/** A fee carries the season chosen, every other purpose the season of its date; none known is refused by the caller. */
export async function fieldsFor(store: PresenceStore, f: PaymentFor, collectedAtRink: boolean, paidOn: string): Promise<Fields | null> {
  const seasons = await store.seasons();
  const season = f.kind === 'cotizatie' ? (seasons.find((s) => s.id === f.seasonId) ?? null) : seasonOfDate(seasons, paidOn);
  return season ? { fields: purposeFields(f, collectedAtRink, season.id), season } : null;
}

/** Lessons before subscriptions (7.1), each sorted and unique. */
export async function lockLinks(store: PresenceStore, links: readonly Link[]): Promise<void> {
  const unique = (ids: (string | null)[]): string[] => [...new Set(ids.filter((id): id is string => id !== null))].sort();
  for (const id of unique(links.map((l) => l.lessonId))) await store.lockLesson(id);
  for (const id of unique(links.map((l) => l.subscriptionId))) await store.lockSubscription(id);
}

export const sameLink = (a: Link, b: Link): boolean => a.subscriptionId === b.subscriptionId && a.lessonId === b.lessonId;

/** The link must belong to the athlete: an abonament not cancelled, a lesson saved and present (8 decided). */
export async function linkIsValid(store: PresenceStore, athleteId: string, link: Link): Promise<boolean> {
  if (link.subscriptionId !== null) {
    const sub = await store.subscription(link.subscriptionId);
    return sub !== null && sub.athleteId === athleteId && !sub.cancelled;
  }
  if (link.lessonId !== null) {
    const lesson = await store.lesson(link.lessonId);
    return lesson !== null && lesson.athleteId === athleteId && lesson.state === 'saved' && lesson.present === true;
  }
  return true;
}

/** "Pentru" as the payment's own lines show it. */
export async function purposeTextOf(store: PresenceStore, p: Pick<PaymentRow, 'purpose' | 'clubMonth' | 'subscriptionId' | 'seasonId'>): Promise<string> {
  const itemName = p.subscriptionId === null ? null : ((await store.subscription(p.subscriptionId))?.itemName ?? null);
  const seasonLabel = p.purpose === 'cotizatie' ? ((await store.seasons()).find((s) => s.id === p.seasonId)?.label ?? null) : null;
  return purposeText(p, { itemName, seasonLabel });
}

export const writeOf = ({ id: _id, ...fields }: PaymentRow): PaymentWrite => fields;

export const currentAcs = async (store: PresenceStore, athleteId: string, seasonId: string): Promise<AcsState | null> =>
  (await store.acsRows({ athleteId, seasonId }))[0]?.state ?? null;

/** Sets A.C.S. of the season and answers its Istoric line and the step that puts the old state back. */
export async function moveAcs(store: PresenceStore, athleteId: string, season: Pick<SeasonRecord, 'id' | 'label'>, from: AcsState | null, to: AcsState | null): Promise<AcsMove> {
  await store.setAcs(athleteId, season.id, to);
  return {
    line: { subjectType: SUBJECT.athlete, subjectId: athleteId, action: HISTORY_ACTIONS.acsChanged, changes: { season: season.label, from, to } },
    step: { op: 'setAcs', athleteId, seasonId: season.id, state: from },
  };
}

/** Back to the state before a fee, when no other live fee of its season remains and A.C.S. is still Da (4.17, C9). */
export async function revertFee(store: PresenceStore, p: PaymentRow): Promise<AcsMove | null> {
  const season = (await store.seasons()).find((s) => s.id === p.seasonId);
  if (!season) return null;
  const current = await currentAcs(store, p.athleteId, p.seasonId);
  const { revert, to } = acsRevert(p, await store.payments({ athleteId: p.athleteId }), current);
  return revert ? moveAcs(store, p.athleteId, season, current, to) : null;
}

export const paymentLine = (paymentId: string, action: string, changes: Record<string, unknown>): Line => ({ subjectType: SUBJECT.payment, subjectId: paymentId, action, changes });
export const athleteLine = (athleteId: string, action: string, changes: Record<string, unknown>): Line => ({ subjectType: SUBJECT.athlete, subjectId: athleteId, action, changes });

/** The payment is guarded, and so is every A.C.S. row a step touches (7.3). */
export async function paymentGuards(store: PresenceStore, paymentId: string, steps: readonly PresenceUndoStep[]): Promise<PresenceGuard[]> {
  const guards = [await guardOf(store, 'payment', paymentId)];
  for (const step of steps) if (step.op === 'setAcs') guards.push(await guardOf(store, 'acs', acsGuardId(step.athleteId, step.seasonId)));
  return guards;
}

export async function recordPaymentAction(ctx: PresenceContext, athleteId: string, paymentId: string, lines: Line[], steps: PresenceUndoStep[]): Promise<string> {
  return recordPresenceAction(ctx.store, ctx.actor, lines, { steps, athletes: [athleteId], guards: await paymentGuards(ctx.store, paymentId, steps) });
}
