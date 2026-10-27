import { guarded, refuse } from '../../admin-result';
import { done, type ActionResult, type Line } from '../../groups/action-log';
import { isRecord } from '../../narrow';
import { SUBJECT } from '../../subjects';
import { guardOf, recordPresenceAction } from '../action-log';
import type { PresenceContext } from '../context';
import { PRESENCE_ERRORS } from '../copy/core';
import { SUBSCRIPTION_COPY } from '../copy/subscriptions';
import { P5_ACTIONS } from '../history-lines';
import type { PresenceStore } from '../store';
import { usedSlots } from '../subscriptions';
import type { SubscriptionRow } from '../types';
import type { PresenceGuard, PresenceUndoStep } from '../undo';
import { extendableIds, extendedValues, extendKey, schoolListIds } from './rules';

const MAX_WEEKS = 12;

type Preview = { rows: SubscriptionRow[]; key: string };

async function previewOf(store: PresenceStore, today: string): Promise<Preview> {
  const subs = await store.subscriptions();
  const used = usedSlots(await store.attendances({ subscriptionIds: subs.map((s) => s.id) }));
  const schoolIds = schoolListIds(await store.priceListRecords(), await store.sections());
  const ids = new Set(extendableIds(subs, used, schoolIds, today));
  const rows = subs.filter((s) => ids.has(s.id)).sort((a, b) => a.id.localeCompare(b.id));
  return { rows, key: extendKey(rows) };
}

/** The abonamente active today on a school list, and the key the confirmation sends back (5.9, C77). */
export async function extendPreview(store: PresenceStore, today: string): Promise<{ count: number; key: string }> {
  const { rows, key } = await previewOf(store, today);
  return { count: rows.length, key };
}

function readBody(body: unknown): { weeks: number; key: string } | null {
  if (!isRecord(body) || typeof body.key !== 'string' || body.key === '') return null;
  const weeks = body.weeks;
  return typeof weeks === 'number' && Number.isInteger(weeks) && weeks >= 1 && weeks <= MAX_WEEKS ? { weeks, key: body.key } : null;
}

const extendedLines = (sub: SubscriptionRow, weeks: number, to: string): Line[] => {
  const changes = { weeks, from: sub.validUntil, to };
  return [
    { subjectType: SUBJECT.athlete, subjectId: sub.athleteId, action: P5_ACTIONS.subscriptionExtended, changes },
    { subjectType: SUBJECT.subscription, subjectId: sub.id, action: P5_ACTIONS.subscriptionExtended, changes },
  ];
};

async function extendLocked(ctx: PresenceContext, weeks: number, key: string): Promise<ActionResult<{ count: number; weeks: number }>> {
  for (const row of (await previewOf(ctx.store, ctx.today)).rows) await ctx.store.lockSubscription(row.id);
  const now = await previewOf(ctx.store, ctx.today);
  if (now.rows.length === 0 || now.key !== key) return refuse(409, SUBSCRIPTION_COPY.extendStale);
  const lines: Line[] = [];
  const steps: PresenceUndoStep[] = [];
  for (const sub of now.rows) {
    const next = extendedValues(sub, weeks);
    await ctx.store.updateSubscription(sub.id, next);
    steps.push({ op: 'setSubscription', id: sub.id, values: { extendedWeeks: sub.extendedWeeks, validUntil: sub.validUntil } });
    lines.push(...extendedLines(sub, weeks, next.validUntil));
  }
  const guards: PresenceGuard[] = [];
  for (const sub of now.rows) guards.push(await guardOf(ctx.store, 'subscription', sub.id));
  const athletes = [...new Set(now.rows.map((s) => s.athleteId))];
  const actionId = await recordPresenceAction(ctx.store, ctx.actor, lines, { steps, athletes, guards });
  return done({ count: now.rows.length, weeks }, actionId);
}

/** Extends every abonament of the preview by the weeks; a changed set or key is refused (decided 3). Locks the abonamente only (7.1). */
export async function extendSubscriptions(ctx: PresenceContext, body: unknown): Promise<ActionResult<{ count: number; weeks: number }>> {
  const read = readBody(body);
  if (!read) return refuse(400, PRESENCE_ERRORS.invalid);
  return guarded(ctx.log, '[subscription-extend]', () => ctx.store.transaction(() => extendLocked(ctx, read.weeks, read.key)));
}
