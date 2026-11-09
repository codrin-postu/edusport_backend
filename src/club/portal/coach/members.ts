import { refuse, type AdminResult } from '../../admin-result';
import { isCurrentMembership } from '../../group-membership';
import type { ActionResult } from '../../groups/action-log';
import { GROUP_ERRORS } from '../../groups/copy';
import { isIsoDate } from '../../groups/dates';
import { moveMembershipFrom, removeMembershipFrom } from '../../groups/members';
import type { GroupRecord } from '../../groups/types';
import { currentSeason } from '../../groups/season-pick';
import { seasonBounds } from '../../groups/series';
import { presenceCarry } from '../../presence/subscriptions/move';
import { isRecord } from '../../narrow';
import { PORTAL_ERRORS, PORTAL_TOASTS } from '../copy';
import type { CoachMemberChange } from './api-types';
import { forbidden, type CoachContexts, type CoachResult } from './context';
import { groupAccess } from './ownership';

const plain = <T>(r: ActionResult<T>): AdminResult<T> => (r.ok === false ? r : { ok: true, data: r.data.value });

/** `from`: `YYYY-MM-DD`, not before today and not after the season end. `toGroupId` is null when a move names no target (answered "Alege grupa." later). */
export function readChangeBody(body: unknown, today: string, seasonEnd: string, move: boolean): { toGroupId: string | null; from: string } | null {
  if (!isRecord(body)) return null;
  const { toGroupId, from } = body;
  if (!isIsoDate(from) || from < today || from > seasonEnd) return null;
  if (!move) return { toGroupId: null, from };
  if (toGroupId !== undefined && typeof toGroupId !== 'string') return null;
  return { toGroupId: typeof toGroupId === 'string' && toGroupId ? toGroupId : null, from };
}

type Source = { membershipId: string; athleteName: string; groupName: string; from: string; toGroupId: string | null };

/** Permission before any read of the child: the source group must be own; then the body; then the target (move) and the current membership. */
async function resolve(c: CoachContexts, groupId: string, athleteId: string, body: unknown, move: boolean): Promise<AdminResult<Source> | ReturnType<typeof forbidden>> {
  const store = c.presence.store;
  const source = await store.group(groupId);
  if (groupAccess(source, c.coach.teamMemberId) !== 'own' || !source) return forbidden(PORTAL_ERRORS.noAccess);
  const season = currentSeason(await store.seasons());
  const read = season ? readChangeBody(body, c.today, seasonBounds(season).end, move) : null;
  if (!season || !read) return refuse(400, PORTAL_ERRORS.invalid);
  if (move) {
    const target = read.toGroupId ? await store.group(read.toGroupId) : null;
    if (!target || !target.active || target.id === groupId) return refuse(400, GROUP_ERRORS.pickGroup);
    if (groupAccess(target, c.coach.teamMemberId) !== 'own') return forbidden(PORTAL_ERRORS.noAccess);
  }
  const row = (await store.memberships({ athleteId, seasonId: season.id })).find((m) => m.groupId === groupId && isCurrentMembership(m));
  const athlete = row ? await store.athlete(athleteId) : null;
  if (!row || !athlete) return refuse(409, GROUP_ERRORS.stale);
  return { ok: true, data: { membershipId: row.id, athleteName: athlete.name ?? '', groupName: source.name, from: read.from, toGroupId: read.toGroupId } };
}

/** Re-run under the group locks: a group the coach no longer owns (or that went inactive) refuses the change. */
const ownCheck = (c: CoachContexts) => (g: GroupRecord): string | null => (groupAccess(g, c.coach.teamMemberId) === 'own' ? null : PORTAL_ERRORS.noAccess);

const answer = (s: Source, groupName: string): CoachMemberChange => ({ athleteName: s.athleteName, groupName, from: s.from, toast: PORTAL_TOASTS.saved });

/** "Mută" from a date, source and target both own (user 2026-11-09). */
export async function moveMember(c: CoachContexts, groupId: string, athleteId: string, body: unknown): Promise<CoachResult<CoachMemberChange>> {
  const s = await resolve(c, groupId, athleteId, body, true);
  if (s.ok === false) return s;
  const to = s.data.toGroupId as string;
  const res = plain(await moveMembershipFrom(c.groups, s.data.membershipId, to, s.data.from, presenceCarry(c.presence.store).carry, ownCheck(c)));
  if (res.ok === false) return res;
  return { ok: true, data: answer(s.data, res.data.groupName) };
}

/** "Scoate din grupă" from a date. */
export async function removeMember(c: CoachContexts, groupId: string, athleteId: string, body: unknown): Promise<CoachResult<CoachMemberChange>> {
  const s = await resolve(c, groupId, athleteId, body, false);
  if (s.ok === false) return s;
  const res = plain(await removeMembershipFrom(c.groups, s.data.membershipId, s.data.from, ownCheck(c)));
  if (res.ok === false) return res;
  return { ok: true, data: answer(s.data, s.data.groupName) };
}
