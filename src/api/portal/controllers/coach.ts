import { refuseWith, type AdminCtx } from '../../../club/admin-http';
import { ADMIN_ERRORS } from '../../../club/athletes/errors';
import { BFF_HEADERS } from '../../../club/portal/auth/bff';
import { portalAuthContext, type PortalAuthContext } from '../../../club/portal/auth/context';
import { limiter } from '../../../club/portal/auth/limit';
import { portalSessions } from '../../../club/portal/sessions';
import { addMembers, addNewAthlete, readCard, searchAthletes } from '../../../club/portal/coach/athletes';
import { coachContexts, type CoachContexts, type CoachResult, type CoachState } from '../../../club/portal/coach/context';
import { readCoachGroupPage, readGroups } from '../../../club/portal/coach/groups';
import { readCoachHistory } from '../../../club/portal/coach/history';
import { createCoachLesson, deleteCoachLesson, planCoachLesson, readCoachLesson, saveCoachLesson } from '../../../club/portal/coach/lessons';
import { changePassword, listDevices, readMe, revokeDevice, saveMe } from '../../../club/portal/coach/me';
import { moveMember, removeMember } from '../../../club/portal/coach/members';
import { checkCoachSession, readCoachSession, readSavedDays, saveCoachSession } from '../../../club/portal/coach/presence';
import {
  coachAddProgram, coachChangeProgram, coachDeleteClass, coachEndProgram, coachProgramPublic, coachSetDate, readCoachProgram,
} from '../../../club/portal/coach/program';
import { readCoachCalendar } from '../../../club/portal/coach/calendar';
import { readCoachCompetitions } from '../../../club/portal/coach/competitions';
import { readToday } from '../../../club/portal/coach/today';

type Headers = Record<string, string | string[] | undefined>;
type CoachCtx = AdminCtx & { request: { headers: Headers; body?: unknown; header: { authorization?: string } }; state: { coach: CoachState } };
type Answer<T> = CoachResult<T> | { ok: false; status: 401 | 410 | 429 | 502 | 503; error: string };

/** 200 `{ data }` or the refusal in the shared shape. A coach answer never carries `undo` (spec S43). */
function respondData<T>(ctx: AdminCtx, result: Answer<T>): void {
  if (result.ok === true) {
    ctx.body = { data: result.data };
    return;
  }
  refuseWith(ctx, result.status, result.error);
}

/** A result of the phase 5 action wrapper (`{ value, actionId }`) answered as `{ data: value }`. */
type Acted<T> = { ok: true; data: { value: T; actionId?: unknown } } | { ok: false; status: number; error: string; inactive?: unknown };

/** The presence save: the reactivation 409 keeps its `details.inactive` body, success answers the value only. */
export function respondCoachSave(ctx: AdminCtx, outcome: Acted<unknown>): void {
  if (outcome.ok === true) {
    ctx.body = { data: outcome.data.value };
    return;
  }
  refuseWith(ctx, outcome.status, outcome.error);
  if ('inactive' in outcome && outcome.inactive !== undefined) {
    ctx.body = { data: null, error: { status: outcome.status, name: 'ClubAdminError', message: outcome.error, details: { inactive: outcome.inactive } } };
  }
}

type Work = (c: CoachContexts, ctx: CoachCtx) => Promise<void>;

/**
 * One fresh set of contexts per request (the portal store keeps its transaction variable). An unexpected throw is logged
 * as the handler name and the error name only, and answered 500 with the shared copy.
 */
const coachOnly = (tag: string, work: Work) => async (ctx: CoachCtx): Promise<void> => {
  try {
    await work(coachContexts(strapi, ctx.state.coach), ctx);
  } catch (err) {
    strapi.log.error(`[portal-coach] ${tag} failed: ${err instanceof Error ? err.name : 'error'}`);
    refuseWith(ctx, 500, ADMIN_ERRORS.failed);
  }
};

const param = (ctx: AdminCtx, key: string): string => ctx.params[key] ?? '';
const headerOf = (ctx: CoachCtx, name: string): string | null => {
  const raw = ctx.request.headers[name];
  const v = Array.isArray(raw) ? raw[0] : raw;
  return typeof v === 'string' && v !== '' ? v : null;
};

/** Auth pieces on the request's own portal store, so password change and session revocation share one transaction variable. */
function authOn(c: CoachContexts, ctx: CoachCtx): CoachContexts & { auth: PortalAuthContext } {
  const base = portalAuthContext(strapi, { ...ctx, request: { ...ctx.request, headers: ctx.request.headers } });
  const now = c.presence.now;
  return { ...c, auth: { ...base, store: c.portal, sessions: portalSessions(c.portal, now), limits: limiter(c.portal, now), now } };
}

/** Portal coach API (routes/02-coach.ts). */
export default {
  me: coachOnly('me', async (c, ctx) => respondData(ctx, await readMe(c))),
  saveMe: coachOnly('saveMe', async (c, ctx) => respondData(ctx, await saveMe(c, ctx.request.body))),
  password: coachOnly('password', async (c, ctx) => respondData(ctx, await changePassword(authOn(c, ctx), ctx.request.body))),
  devices: coachOnly('devices', async (c, ctx) => respondData(ctx, await listDevices(c, headerOf(ctx, BFF_HEADERS.device)))),
  revokeDevice: coachOnly('revokeDevice', async (c, ctx) => respondData(ctx, await revokeDevice(c, param(ctx, 'id')))),
  today: coachOnly('today', async (c, ctx) => respondData(ctx, await readToday(c, ctx.query.date))),
  groups: coachOnly('groups', async (c, ctx) => respondData(ctx, await readGroups(c))),
  group: coachOnly('group', async (c, ctx) => respondData(ctx, await readCoachGroupPage(c, param(ctx, 'documentId')))),
  program: coachOnly('program', async (c, ctx) => respondData(ctx, await readCoachProgram(c, param(ctx, 'documentId'), ctx.query.month))),
  savedDays: coachOnly('savedDays', async (c, ctx) => respondData(ctx, await readSavedDays(c, param(ctx, 'documentId'), ctx.query.month))),
  addProgram: coachOnly('addProgram', async (c, ctx) => respondData(ctx, await coachAddProgram(c, param(ctx, 'documentId'), ctx.request.body))),
  programPublic: coachOnly('programPublic', async (c, ctx) => respondData(ctx, await coachProgramPublic(c, param(ctx, 'documentId'), ctx.request.body))),
  addMembers: coachOnly('addMembers', async (c, ctx) => respondData(ctx, await addMembers(c, param(ctx, 'documentId'), ctx.request.body))),
  calendar: coachOnly('calendar', async (c, ctx) => respondData(ctx, await readCoachCalendar(c, ctx.query.month))),
  competitions: coachOnly('competitions', async (c, ctx) => respondData(ctx, await readCoachCompetitions(c, ctx.query))),
  moveMember: coachOnly('moveMember', async (c, ctx) => respondData(ctx, await moveMember(c, param(ctx, 'documentId'), param(ctx, 'athleteId'), ctx.request.body))),
  removeMember: coachOnly('removeMember', async (c, ctx) => respondData(ctx, await removeMember(c, param(ctx, 'documentId'), param(ctx, 'athleteId'), ctx.request.body))),
  session: coachOnly('session', async (c, ctx) => respondData(ctx, await readCoachSession(c, ctx.query))),
  sessionCheck: coachOnly('sessionCheck', async (c, ctx) => respondData(ctx, await checkCoachSession(c, ctx.request.body))),
  saveSession: coachOnly('saveSession', async (c, ctx) => respondCoachSave(ctx, (await saveCoachSession(c, ctx.request.body)) as Acted<unknown>)),
  createLesson: coachOnly('createLesson', async (c, ctx) => respondData(ctx, await createCoachLesson(c, ctx.request.body))),
  lesson: coachOnly('lesson', async (c, ctx) => respondData(ctx, await readCoachLesson(c, param(ctx, 'documentId')))),
  planLesson: coachOnly('planLesson', async (c, ctx) => respondData(ctx, await planCoachLesson(c, param(ctx, 'documentId'), ctx.request.body))),
  saveLesson: coachOnly('saveLesson', async (c, ctx) => respondData(ctx, await saveCoachLesson(c, param(ctx, 'documentId'), ctx.request.body))),
  deleteLesson: coachOnly('deleteLesson', async (c, ctx) => respondData(ctx, await deleteCoachLesson(c, param(ctx, 'documentId')))),
  searchAthletes: coachOnly('searchAthletes', async (c, ctx) => respondData(ctx, await searchAthletes(c, ctx.query))),
  addAthlete: coachOnly('addAthlete', async (c, ctx) => respondData(ctx, await addNewAthlete(c, ctx.request.body))),
  athlete: coachOnly('athlete', async (c, ctx) => respondData(ctx, await readCard(c, param(ctx, 'documentId')))),
  history: coachOnly('history', async (c, ctx) => respondData(ctx, await readCoachHistory(c, ctx.query.month))),
  changeProgram: coachOnly('changeProgram', async (c, ctx) => respondData(ctx, await coachChangeProgram(c, param(ctx, 'eventId'), ctx.request.body))),
  endProgram: coachOnly('endProgram', async (c, ctx) => respondData(ctx, await coachEndProgram(c, param(ctx, 'eventId'), ctx.request.body))),
  deleteClass: coachOnly('deleteClass', async (c, ctx) => respondData(ctx, await coachDeleteClass(c, param(ctx, 'eventId')))),
  setDate: coachOnly('setDate', async (c, ctx) => respondData(ctx, await coachSetDate(c, param(ctx, 'eventId'), param(ctx, 'date'), ctx.request.body))),
};
