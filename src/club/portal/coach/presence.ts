import { refuse } from '../../admin-result';
import { isRecord } from '../../narrow';
import { ageOnIso } from '../../groups/season-pick';
import type { GroupRecord } from '../../groups/types';
import type { SessionCheck } from '../../presence/attendance/api-types';
import { checkNewSession } from '../../presence/attendance/check';
import { abonamentSlots, readPanelQuery, readSessionPanel } from '../../presence/attendance/panel';
import { rosterOn } from '../../presence/attendance/roster';
import { isTicked, readSaveBody } from '../../presence/attendance/save-plan';
import { saveSession, type SaveOutcome } from '../../presence/attendance/save';
import { resolveScope } from '../../presence/attendance/save-target';
import { PRESENCE_ERRORS } from '../../presence/copy/core';
import { PORTAL_ERRORS } from '../copy';
import type { CoachSession } from './api-types';
import { forbidden, type CoachContexts, type CoachResult, type Forbidden } from './context';
import { groupAccess } from './ownership';
import { presenceRight, type PresenceFacts, type Right } from './rules';
import { toCoachSession } from './views';


const factsOf = (c: CoachContexts, group: GroupRecord | null, t: {
  date: string; saved: boolean; occurrenceKey: string | null; outsideSchedule: boolean; added: boolean; coachIds: string[];
}): PresenceFacts => ({
  access: groupAccess(group, c.coach.teamMemberId), date: t.date, today: c.today, scheduled: t.occurrenceKey !== null && !t.outsideSchedule && !t.added,
  added: t.added, saved: t.saved, listed: t.saved && t.coachIds.includes(c.coach.teamMemberId),
});

/** Read of a session panel (spec 8.2): only what the right allows, no prices, history or birth dates. */
export async function readCoachSession(c: CoachContexts, q: Record<string, unknown>): Promise<CoachResult<CoachSession>> {
  const query = readPanelQuery(q);
  if (!query) return refuse(400, PORTAL_ERRORS.invalid);
  const store = c.presence.store;
  const panel = await readSessionPanel(store, query, c.today);
  if (panel.ok === false) return panel;
  const p = panel.data;
  const group = await store.group(p.groupId);
  const facts = factsOf(c, group, {
    date: p.date, saved: p.sessionId !== null, occurrenceKey: p.occurrenceKey, outsideSchedule: p.outsideSchedule, added: p.sessionId !== null ? p.occurrenceKey === null : p.added !== null, coachIds: p.coachIds,
  });
  const right = presenceRight(facts);
  if (!right.read || !group) return forbidden(PORTAL_ERRORS.noAccess);
  const athletes = await store.athletes();
  const ages = new Map(athletes.map((a) => [a.id, ageOnIso(a.birthDate, c.today)]));
  const slots = p.kind === 'school' ? await abonamentSlots(store, p.rows.map((r) => r.athleteId), group.priceListId, p.date) : new Map();
  const mine = c.coach.teamMemberId;
  const shown = facts.access === 'other' && !facts.saved ? { ...p, coachIds: [mine] } : p;
  return { ok: true, data: toCoachSession(shown, { ages, slots, team: await store.teamMembers(), right, standIn: facts.access === 'other' }) };
}

/** "+ Ședință nouă" check: own groups only, so another coach's group never gets an "În afara programului" session (ruling 7). */
export async function checkCoachSession(c: CoachContexts, body: unknown): Promise<CoachResult<SessionCheck>> {
  const groupId = isRecord(body) && typeof body.groupId === 'string' ? body.groupId : null;
  if (groupId === null) return refuse(400, PORTAL_ERRORS.invalid);
  const group = await c.presence.store.group(groupId);
  if (groupAccess(group, c.coach.teamMemberId) !== 'own') return forbidden(PORTAL_ERRORS.noAccess);
  return checkNewSession(c.presence.store, body);
}

const refusalFor = (right: Right): Forbidden => forbidden(right.archived ? PORTAL_ERRORS.archived : PORTAL_ERRORS.noAccess);

/** Saves through the phase 5 save after the right, the stand-in's own name and the list of the date are checked. */
export async function saveCoachSession(c: CoachContexts, body: unknown): Promise<SaveOutcome | Forbidden> {
  const b = readSaveBody(body);
  if (!b) return refuse(400, PRESENCE_ERRORS.invalid);
  const scope = await resolveScope(c.presence.store, b);
  if ('ok' in scope) return scope;
  const { target, group, season, kind } = scope;
  const right = presenceRight(factsOf(c, group, {
    date: target.date, saved: target.session !== null, occurrenceKey: target.occurrenceKey, outsideSchedule: target.outsideSchedule, added: target.source === 'added',
    coachIds: target.session?.coachIds ?? [],
  }));
  if (!right.write) return refusalFor(right);
  if (right.mustIncludeMe && !b.coachIds.includes(c.coach.teamMemberId)) return forbidden(PORTAL_ERRORS.noAccess);
  const store = c.presence.store;
  const onSession = target.session ? (await store.attendances({ sessionIds: [target.session.id] })).map((r) => r.athleteId) : [];
  const allowed = new Set([...rosterOn(await store.memberships(), group.id, season.id, target.date), ...onSession]);
  if (b.ticks.some((t) => isTicked(kind, t) && !allowed.has(t.athleteId))) return refuse(400, PRESENCE_ERRORS.invalid);
  return saveSession(c.presence, body);
}
