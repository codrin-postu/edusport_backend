import { refuseWith, type AdminCtx } from '../../../club/admin-http';
import { ADMIN_ERRORS } from '../../../club/athletes/errors';
import { pdfHeaders } from '../../../club/documents/requests';
import { BFF_HEADERS } from '../../../club/portal/auth/bff';
import { portalAuthContext, type PortalAuthContext, type PortalResult } from '../../../club/portal/auth/context';
import { limiter } from '../../../club/portal/auth/limit';
import { PORTAL_ERRORS } from '../../../club/portal/copy';
import { portalSessions } from '../../../club/portal/sessions';
import { currentSeason } from '../../../club/groups/season-pick';
import { readAthletes } from '../../../club/portal/sportiv/athletes';
import { readCalendar, ownItems } from '../../../club/portal/sportiv/calendar';
import { sportivContext, type SportivContext } from '../../../club/portal/sportiv/context';
import { holdsAthlete, NO_ACCESS, type HolderState } from '../../../club/portal/sportiv/holder';
import { markPromotionSeen, readHome } from '../../../club/portal/sportiv/home';
import { readHistory, readHistoryPage, readProfile } from '../../../club/portal/sportiv/history';
import { toIcs } from '../../../club/portal/sportiv/ics';
import { changePassword, listDevices, readMe, revokeDevice, saveMe, saveNotifications } from '../../../club/portal/sportiv/me';
import { readAcord, readMoney, readPayments, readSubscriptions } from '../../../club/portal/sportiv/money';
import { readPath } from '../../../club/portal/sportiv/path';
import type { AdminResult } from '../../../club/admin-result';

type Headers = Record<string, string | string[] | undefined>;
type SportivCtx = AdminCtx & {
  request: { headers: Headers; body?: unknown; header: { authorization?: string } };
  state: { holder?: HolderState };
  set(headers: Record<string, string>): void;
};

/** A file answer (the phone calendar, the registration PDF): headers and the bytes, not the `{ data }` envelope. */
type FileAnswer = { ok: true; file: { headers: Record<string, string>; body: Buffer | string } };
type Answer = AdminResult<unknown> | PortalResult<unknown> | FileAnswer;

/** 200 `{ data }`, the file as it is, or the refusal in the shared shape. A sportiv answer never carries `undo`. */
function respondAnswer(ctx: SportivCtx, result: Answer): void {
  if (result.ok !== true) return refuseWith(ctx, result.status, result.error);
  if ('file' in result) {
    ctx.set(result.file.headers);
    ctx.body = result.file.body;
    return;
  }
  ctx.body = { data: result.data };
}

/** A reader that returns the data itself (not an admin result) as an answer. */
const done = (data: unknown): Answer => ({ ok: true, data });

/** An unexpected throw is logged as the handler name and the error name only, and answered 500 with the shared copy. */
async function guarded(tag: string, ctx: SportivCtx, work: (holder: HolderState) => Promise<Answer>): Promise<void> {
  const holder = ctx.state.holder;
  if (!holder) return refuseWith(ctx, 401, PORTAL_ERRORS.wrongLogin);
  try {
    respondAnswer(ctx, await work(holder));
  } catch (err) {
    strapi.log.error(`[portal-sportiv] ${tag} failed: ${err instanceof Error ? err.name : 'error'}`);
    refuseWith(ctx, 500, ADMIN_ERRORS.failed);
  }
}

/**
 * Every `:athleteId` handler runs through here: the id must be one the holder holds right now (the policy read it again for this request),
 * else 403 `NO_ACCESS` before a context is built, so nothing is read for a foreign athlete. `run` answers with data or a file.
 */
export async function withAthlete(tag: string, ctx: SportivCtx, run: (c: SportivContext, athleteId: string) => Promise<Answer>): Promise<void> {
  const athleteId = ctx.params.athleteId ?? '';
  const holder = ctx.state.holder;
  if (holder && !holdsAthlete(holder, athleteId)) return refuseWith(ctx, 403, NO_ACCESS);
  return guarded(tag, ctx, (h) => run(sportivContext(strapi, h), athleteId));
}

/** A handler on the holder's own account (no athlete id). */
const own = (tag: string, run: (c: SportivContext, ctx: SportivCtx) => Promise<Answer>) => (ctx: SportivCtx): Promise<void> =>
  guarded(tag, ctx, (holder) => run(sportivContext(strapi, holder), ctx));

const athleteRoute = (tag: string, run: (c: SportivContext, athleteId: string, ctx: SportivCtx) => Promise<Answer>) => (ctx: SportivCtx): Promise<void> =>
  withAthlete(tag, ctx, (c, athleteId) => run(c, athleteId, ctx));

const headerOf = (ctx: SportivCtx, name: string): string | null => {
  const raw = ctx.request.headers[name];
  const v = Array.isArray(raw) ? raw[0] : raw;
  return typeof v === 'string' && v !== '' ? v : null;
};

/** Auth pieces on the request's own portal store, so a password change and the session revocation share one transaction variable. */
function withAuth(c: SportivContext, ctx: SportivCtx): SportivContext & { auth: PortalAuthContext } {
  const base = portalAuthContext(strapi, { ...ctx, request: { ...ctx.request, headers: ctx.request.headers } });
  const now = c.presence.now;
  return { ...c, auth: { ...base, store: c.portal, sessions: portalSessions(c.portal, now), limits: limiter(c.portal, now), now } };
}

/** `edusport-<prenume>.ics` in plain letters, digits and hyphens. */
const icsName = (firstName: string): string => {
  const slug = firstName.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `edusport-${slug === '' ? 'sportiv' : slug}.ics`;
};

/** The phone calendar file: the athlete's items from today to the season end (`toIcs` drops what is past and caps at 300). */
async function readIcs(c: SportivContext, athleteId: string): Promise<Answer> {
  const athlete = await c.presence.store.athlete(athleteId);
  if (!athlete) throw new Error('sportiv ics: athlete not found');
  const firstName = (athlete.name ?? '').split(/\s+/).find(Boolean) ?? '';
  const season = currentSeason(await c.presence.store.seasons());
  const items = season && season.endMonth >= c.today ? await ownItems(c, athleteId, c.today, season.endMonth) : [];
  return {
    ok: true,
    file: {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${icsName(firstName)}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Robots-Tag': 'noindex',
      },
      body: toIcs(items, c.presence.now(), firstName),
    },
  };
}

async function readAcordFile(c: SportivContext, athleteId: string): Promise<Answer> {
  const found = await readAcord(c, athleteId);
  return found.ok === true ? { ok: true, file: { headers: pdfHeaders(found.data.fileName), body: found.data.data } } : found;
}

/** Portal sportiv API (routes/04-sportiv.ts). */
export default {
  me: own('me', async (c) => done(await readMe(c))),
  saveMe: own('saveMe', (c, ctx) => saveMe(c, ctx.request.body)),
  saveNotifications: own('saveNotifications', (c, ctx) => saveNotifications(c, ctx.request.body)),
  password: own('password', (c, ctx) => changePassword(withAuth(c, ctx), ctx.request.body)),
  devices: own('devices', async (c, ctx) => done(await listDevices(c, headerOf(ctx, BFF_HEADERS.device)))),
  revokeDevice: own('revokeDevice', (c, ctx) => revokeDevice(c, ctx.params.id ?? '')),
  athletes: own('athletes', async (c) => done(await readAthletes(c))),
  home: athleteRoute('home', async (c, id) => done(await readHome(c, id))),
  promotionSeen: athleteRoute('promotionSeen', async (c, id) => done(await markPromotionSeen(c, id))),
  profile: athleteRoute('profile', async (c, id) => done(await readProfile(c, id))),
  history: athleteRoute('history', async (c, id, ctx) => done(await readHistory(c, id, ctx.query.page))),
  calendar: athleteRoute('calendar', (c, id, ctx) => readCalendar(c, id, ctx.query.month ?? c.today.slice(0, 7))),
  calendarIcs: athleteRoute('calendarIcs', (c, id) => readIcs(c, id)),
  path: athleteRoute('path', async (c, id) => done(await readPath(c, id))),
  money: athleteRoute('money', async (c, id) => done(await readMoney(c, id))),
  payments: athleteRoute('payments', async (c, id, ctx) => done(await readPayments(c, id, readHistoryPage(ctx.query.page)))),
  subscriptions: athleteRoute('subscriptions', async (c, id) => done(await readSubscriptions(c, id))),
  acord: athleteRoute('acord', (c, id) => readAcordFile(c, id)),
};
