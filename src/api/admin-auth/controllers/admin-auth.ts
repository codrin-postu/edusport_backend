import { indexParam, refuseWith, respond, type AdminCtx } from '../../../club/admin-http';
import type { AdminRow } from '../../../club/admin-login/admins';
import { adminLoginContext, adminOrigin, originAllowed, type AdminLoginContext } from '../../../club/admin-login/context';
import { ADMIN_DEVICE_COOKIE, disconnectAdminDevice, listAdminDevices } from '../../../club/admin-login/devices';
import { adminGoogleCallback, startAdminGoogle } from '../../../club/admin-login/google';
import { adminPasskeyActor, adminPasskeyOptions, adminPasskeyVerify, adminReauth } from '../../../club/admin-login/passkey';
import { acceptAdminInvite, readAdminInvite } from '../../../club/admin-login/invite';
import { loginAdmin, secondStepAdmin, sendAdminLoginCode } from '../../../club/admin-login/login';
import { confirmAdminReset, requestAdminReset } from '../../../club/admin-login/reset';
import {
  adminsList, adminSubject, changeAdminPassword, currentAdmin, readAdminGoogle, readSecurity, resetAdminTwoFactor, unlinkAdminGoogle, withActor,
} from '../../../club/admin-login/security';
import type { KoaContext } from '../../../club/admin-login/session';
import { PORTAL_ERRORS } from '../../../club/portal/copy';
import { SECURITY_ERRORS } from '../../../club/security/copy';
import { confirmEmail, confirmTotp, newBatch, sendEnrolCode, startTotp, turnOff } from '../../../club/security/factors';
import { addPasskey, dismissOffer, removeKey, renameKey, startPasskey } from '../../../club/security/passkey-actions';
import { KeysMissing } from '../../../club/security/keys';

type Ctx = AdminCtx & KoaContext & { request: { headers: Record<string, string | string[] | undefined> }; redirect: (url: string) => void };
type Handler = (ctx: Ctx) => Promise<void>;

const header = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/**
 * Every POST checks `Origin` first (403, nothing else runs, no store is built). Each request builds its own login context and stores
 * (B2 L8). A `KeysMissing` that gets this far is a 503 and never a 500 (B2 L5). An unexpected throw is logged as the handler name and
 * the error name only, and answered 500 with the shared copy.
 */
const sameOrigin = (tag: string, handler: Handler): Handler => async (ctx) => {
  if (!originAllowed(header(ctx.request.headers.origin), adminOrigin())) return refuseWith(ctx, 403, 'Forbidden');
  return guarded(tag, handler)(ctx);
};

/** The error handling of `sameOrigin` alone (reads that change nothing, and the Google navigations). */
const guarded = (tag: string, handler: Handler): Handler => async (ctx) => {
  try {
    return await handler(ctx);
  } catch (err) {
    if (err instanceof KeysMissing) return refuseWith(ctx, 503, SECURITY_ERRORS.unavailable);
    strapi.log.error(`[admin-auth] ${tag} failed: ${err instanceof Error ? err.name : 'error'}`);
    return refuseWith(ctx, 500, PORTAL_ERRORS.failed);
  }
};

/** The browser's own navigations (Google start and callback): no Origin to check, and every failure is the failure page, never a JSON error. */
const navigation = (tag: string, failed: string, handler: (ctx: Ctx) => Promise<string> | string): Handler => async (ctx) => {
  try {
    return ctx.redirect(await handler(ctx));
  } catch (err) {
    strapi.log.error(`[admin-auth] ${tag} failed: ${err instanceof Error ? err.name : 'error'}`);
    return ctx.redirect(failed);
  }
};

type Answer = Parameters<typeof respond>[1];
type Run = (c: AdminLoginContext, admin: AdminRow, ctx: Ctx) => Promise<Answer>;

/**
 * A Securitate route: the route policy has checked the access token; this reads who it is (401 when it is not an admin that may enter),
 * builds the context with the caller's name on its history lines and answers the service result. A change also checks `Origin` first.
 */
const signedIn = (tag: string, run: Run, o: { change: boolean }): Handler => {
  const body: Handler = async (ctx) => {
    const base = adminLoginContext(strapi, ctx);
    const admin = await currentAdmin(strapi, ctx.request.header.authorization);
    if (!admin) return refuseWith(ctx, 401, PORTAL_ERRORS.wrongLogin);
    return respond(ctx, await run(withActor(base, admin), admin, ctx));
  };
  return o.change ? sameOrigin(tag, body) : guarded(tag, body);
};
const change = (tag: string, run: Run): Handler => signedIn(tag, run, { change: true });
const read = (tag: string, run: Run): Handler => signedIn(tag, run, { change: false });
const deviceCookie = (c: AdminLoginContext): string | null => c.cookie(ADMIN_DEVICE_COOKIE(c.secure));
const bodyCode = (ctx: Ctx): string => {
  const code = typeof ctx.request.body === 'object' && ctx.request.body !== null ? (ctx.request.body as Record<string, unknown>).code : null;
  return typeof code === 'string' ? code : '';
};

/** Admin login API (routes/01-login.ts). */
export default {
  login: sameOrigin('login', async (ctx) => respond(ctx, await loginAdmin(adminLoginContext(strapi, ctx), ctx.request.body))),
  twoFactor: sameOrigin('twoFactor', async (ctx) => respond(ctx, await secondStepAdmin(adminLoginContext(strapi, ctx), ctx.request.body))),
  twoFactorEmail: sameOrigin('twoFactorEmail', async (ctx) => respond(ctx, await sendAdminLoginCode(adminLoginContext(strapi, ctx)))),
  passkeyOptions: sameOrigin('passkeyOptions', async (ctx) => respond(ctx, await adminPasskeyOptions(adminLoginContext(strapi, ctx)))),
  passkeyVerify: sameOrigin('passkeyVerify', async (ctx) => respond(ctx, await adminPasskeyVerify(adminLoginContext(strapi, ctx), ctx.request.body))),
  resetRequest: sameOrigin('resetRequest', async (ctx) => respond(ctx, await requestAdminReset(adminLoginContext(strapi, ctx), ctx.request.body))),
  resetConfirm: sameOrigin('resetConfirm', async (ctx) => respond(ctx, await confirmAdminReset(adminLoginContext(strapi, ctx), ctx.request.body))),
  inviteRead: sameOrigin('inviteRead', async (ctx) => respond(ctx, await readAdminInvite(adminLoginContext(strapi, ctx), ctx.request.body))),
  googleStart: navigation('googleStart', '/intrare?eroare=google', (ctx) => startAdminGoogle(adminLoginContext(strapi, ctx), ctx.query).redirect),
  googleCallback: navigation('googleCallback', '/intrare?eroare=google', async (ctx) => (await adminGoogleCallback(adminLoginContext(strapi, ctx), ctx.query)).redirect),
  inviteGoogle: navigation('inviteGoogle', '/intrare/invitatie?eroare=google', (ctx) => startAdminGoogle(adminLoginContext(strapi, ctx), { registrationToken: ctx.query.registrationToken }).redirect),
  inviteAccept: sameOrigin('inviteAccept', async (ctx) => respond(ctx, await acceptAdminInvite(adminLoginContext(strapi, ctx), ctx.request.body))),
  // Securitate (02-security.ts) and Administratori (03-admins.ts)
  security: read('security', (c, a) => readSecurity(c, a)),
  totpStart: change('totpStart', (c, a) => startTotp(c, adminSubject(a), a.email)),
  totpConfirm: change('totpConfirm', (c, a, ctx) => confirmTotp(c, adminSubject(a), bodyCode(ctx))),
  totpOff: change('totpOff', (c, a) => turnOff(c, adminSubject(a), a.email, 'totp')),
  emailStart: change('emailStart', (c, a) => sendEnrolCode(c, adminSubject(a), a.email)),
  emailConfirm: change('emailConfirm', (c, a, ctx) => confirmEmail(c, adminSubject(a), bodyCode(ctx))),
  emailOff: change('emailOff', (c, a) => turnOff(c, adminSubject(a), a.email, 'email')),
  backupCodes: change('backupCodes', (c, a) => newBatch(c, adminSubject(a))),
  passkeyStart: change('passkeyStart', (c, a) => startPasskey(c, adminPasskeyActor(c, a, deviceCookie(c)))),
  passkeyAdd: change('passkeyAdd', (c, a, ctx) => addPasskey(c, adminPasskeyActor(c, a, deviceCookie(c)), ctx.request.body)),
  passkeyDismiss: change('passkeyDismiss', (c, a) => dismissOffer(c, adminPasskeyActor(c, a, deviceCookie(c)))),
  passkeyRename: change('passkeyRename', (c, a, ctx) => renameKey(c, adminPasskeyActor(c, a, deviceCookie(c)), String(ctx.params.id), ctx.request.body)),
  passkeyDelete: change('passkeyDelete', (c, a, ctx) => removeKey(c, adminPasskeyActor(c, a, deviceCookie(c)), String(ctx.params.id))),
  reauth: change('reauth', (c, a, ctx) => adminReauth(c, a, deviceCookie(c), ctx.request.body)),
  devices: read('devices', async (c, a) => ({ ok: true, data: await listAdminDevices(c.store, a.id, deviceCookie(c), c.now()) })),
  deviceDisconnect: change('deviceDisconnect', (c, a, ctx) => disconnectAdminDevice(c, a.id, String(ctx.params.id), deviceCookie(c))),
  password: change('password', (c, a, ctx) => changeAdminPassword(c, a, ctx.request.body, deviceCookie(c))),
  googleRead: read('googleRead', (c, a) => readAdminGoogle(c, a)),
  googleUnlink: change('googleUnlink', (c, a) => unlinkAdminGoogle(c, a)),
  admins: read('admins', (c, a) => adminsList(c, a)),
  adminReset2fa: change('adminReset2fa', async (c, a, ctx) => {
    const id = indexParam(ctx.params.id);
    return id === null ? { ok: false, status: 404, error: PORTAL_ERRORS.notFound } : resetAdminTwoFactor(c, a, id);
  }),
};
