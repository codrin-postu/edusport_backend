import { guarded, refuse, type AdminResult } from '../admin-result';
import { ADMIN_ERRORS } from '../athletes/errors';
import type { ClubStore, ServiceContext } from '../athletes/store';
import { inactiveAthleteIds } from './inactivity';
import { hiddenUntil, readPersonalDataSettings, reviewNoticeShown, type InactiveSummary } from './settings';

/** GET /api/club/athletes/inactive-summary (spec 5): the dashboard notice. Reads only; nothing runs by itself. */
export async function inactiveSummary(store: ClubStore, now: Date): Promise<InactiveSummary> {
  const [athletes, memberships, registrations, seasons, raw] = await Promise.all([
    store.athletes(), store.memberships(), store.registrations(), store.seasons(), store.personalDataSettings(),
  ]);
  const settings = readPersonalDataSettings(raw);
  const count = inactiveAthleteIds({ athletes, memberships, registrations, seasons, retentionYears: settings.retentionYears, now }).size;
  const seasonLabel = seasons.find((s) => s.isCurrent)?.label ?? null;
  return { retentionYears: settings.retentionYears, count, seasonLabel, shown: reviewNoticeShown(settings, count, seasonLabel) };
}

/** The dashboard notice for the route: a failure is logged once and answered with the shared copy. */
export const readInactiveSummary = (store: ClubStore, log: (message: string) => void, now: Date): Promise<AdminResult<InactiveSummary>> =>
  guarded(log, '[personal-data] reading the yearly review', async () => ({ ok: true, data: await inactiveSummary(store, now) }));

/** "Ascunde până la sezonul următor" (Super Admin): stores the current season label. */
export function hideInactiveReview(ctx: ServiceContext, now: Date): Promise<AdminResult<InactiveSummary>> {
  return guarded(ctx.log, '[personal-data] hiding the yearly review', async () => {
    const seasonLabel = (await ctx.store.seasons()).find((s) => s.isCurrent)?.label ?? null;
    if (!seasonLabel) return refuse(409, ADMIN_ERRORS.stale);
    const settings = readPersonalDataSettings(await ctx.store.personalDataSettings());
    await ctx.store.savePersonalDataSettings(hiddenUntil(settings, seasonLabel));
    return { ok: true, data: await inactiveSummary(ctx.store, now) };
  });
}
