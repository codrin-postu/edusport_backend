import { guardedWrite, refuse, type AdminResult } from '../admin-result';
import { HISTORY_ACTIONS, SUBJECT } from '../history-text';
import { slugify, uniqueSlug } from '../profile-slug';
import type { AthleteRecord } from './api-types';
import { ADMIN_ERRORS } from './errors';
import { readAthleteRecord } from './record';
import type { ClubStore, ServiceContext } from './store';

/** Profil public tab (spec 6.3): create with the page off; switch the page on / off; the editor itself is unchanged. */
async function recordResult(store: ClubStore, id: string): Promise<AdminResult<AthleteRecord>> {
  const record = await readAthleteRecord(store, id, null);
  return record ? { ok: true, data: record } : refuse(404, ADMIN_ERRORS.notFound);
}

export async function createAthleteProfile(ctx: ServiceContext, id: string): Promise<AdminResult<AthleteRecord>> {
  const athlete = await ctx.store.athlete(id);
  if (!athlete) return refuse(404, ADMIN_ERRORS.notFound);
  if (athlete.profileId) return refuse(409, ADMIN_ERRORS.stale);
  const taken = new Set((await ctx.store.profiles()).flatMap((p) => [p.slug, ...p.previousSlugs]));
  const name = athlete.name ?? '';
  const written = await guardedWrite(ctx.log, `[athletes] creating the profile of ${id}`, () => ctx.store.transaction(async () => {
    const profileId = await ctx.store.createProfile(name, uniqueSlug(slugify(name), taken));
    await ctx.store.updateAthlete(id, { profileId });
    await ctx.store.record({ subjectType: SUBJECT.athlete, subjectId: id, action: HISTORY_ACTIONS.profileCreated, actor: ctx.actor });
  }));
  return written.ok === false ? written : recordResult(ctx.store, id);
}

/** "Pagina publică pornită / oprită": only showPublicPage, as today (3b Q3). */
export async function setAthleteProfileVisibility(ctx: ServiceContext, id: string, body: unknown): Promise<AdminResult<AthleteRecord>> {
  const on = body && typeof body === 'object' ? (body as Record<string, unknown>).on : undefined;
  if (typeof on !== 'boolean') return refuse(400, ADMIN_ERRORS.invalid);
  const athlete = await ctx.store.athlete(id);
  if (!athlete) return refuse(404, ADMIN_ERRORS.notFound);
  const profile = (await ctx.store.profiles()).find((p) => p.id === athlete.profileId);
  if (!profile) return refuse(409, ADMIN_ERRORS.stale);
  if (profile.showPublicPage === on) return recordResult(ctx.store, id);
  const written = await guardedWrite(ctx.log, `[athletes] switching the page of ${id}`, () => ctx.store.transaction(async () => {
    await ctx.store.setProfileVisibility(profile.id, on);
    await ctx.store.record({ subjectType: SUBJECT.athlete, subjectId: id, action: HISTORY_ACTIONS.profilePage, changes: { on }, actor: ctx.actor });
  }));
  return written.ok === false ? written : recordResult(ctx.store, id);
}

export async function athleteIdForProfile(store: ClubStore, profileId: string): Promise<string | null> {
  return (await store.athletes()).find((a) => a.profileId === profileId)?.id ?? null;
}
