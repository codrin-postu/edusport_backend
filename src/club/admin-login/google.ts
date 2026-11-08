import { createHash, randomBytes } from 'node:crypto';
import { exchangeCode, googleClient, verifyIdToken, type GoogleClient, type GoogleIdentity } from '../portal/auth/google';
import { hashSecret, sameHash } from '../portal/tokens';
import { SECURITY_ACTIONS } from '../security/copy';
import { adminByEmail, adminById, adminUserService, canEnterAdmin, type AdminRow } from './admins';
import { adminOrigin, type AdminLoginContext } from './context';
import { randomPassword, registerInvited } from './invite';
import { finishAdminLogin } from './login';

/** Spec 4.6: the 10-minute cookie with state, nonce and PKCE verifier; its path is the callback's, so no other request carries it. */
export const ADMIN_GOOGLE_COOKIE = (secure: boolean): string => (secure ? '__Secure-es_adm_goog' : 'es_adm_goog');
export const ADMIN_GOOGLE_PATH = '/api/admin-auth/google';
const COOKIE_MS = 600_000;
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_MAX = 256;
const FAILED = '/intrare?eroare=google';
const FAILED_INVITE = '/intrare/invitatie?eroare=google';
/** Strapi's own name for the access-token cookie (not HttpOnly: the page script moves it, as Strapi's SSO page does). */
const JWT_COOKIE = 'jwtToken';

type Flow = { state: string; nonce: string; verifier: string; remember: boolean; registrationToken: string | null };
type Query = Record<string, unknown>;

const text = (v: unknown, max = TOKEN_MAX): string | null => (typeof v === 'string' && v !== '' && v.length <= max ? v : null);
const random = (): string => randomBytes(32).toString('base64url');
const redirectUri = (): string => `${adminOrigin()}${ADMIN_GOOGLE_PATH}/callback`;
const failure = (flow: Flow | null): { redirect: string } => ({ redirect: flow?.registrationToken ? FAILED_INVITE : FAILED });

/** The browser leaves for Google: state, nonce, verifier, the remember tick and an optional invite token go into the cookie. */
export function startAdminGoogle(c: AdminLoginContext, query: Query, g: GoogleClient | null = googleClient()): { redirect: string } {
  const registrationToken = text(query.registrationToken);
  const flow: Flow = { state: random(), nonce: random(), verifier: random(), remember: query.remember === '1', registrationToken };
  if (!g || (query.registrationToken !== undefined && registrationToken === null)) return failure(flow);
  c.setCookie(ADMIN_GOOGLE_COOKIE(c.secure), Buffer.from(JSON.stringify(flow)).toString('base64url'), COOKIE_MS, ADMIN_GOOGLE_PATH);
  const params = new URLSearchParams({
    client_id: g.clientId, redirect_uri: redirectUri(), response_type: 'code', scope: 'openid email', state: flow.state, nonce: flow.nonce,
    code_challenge: createHash('sha256').update(flow.verifier).digest('base64url'), code_challenge_method: 'S256',
  });
  return { redirect: `${AUTH_URL}?${params.toString()}` };
}

function readFlow(raw: string | null): Flow | null {
  if (!raw) return null;
  try {
    const f = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Record<string, unknown>;
    const [state, nonce, verifier] = [text(f.state), text(f.nonce), text(f.verifier)];
    const token = f.registrationToken === null ? null : text(f.registrationToken);
    if (!state || !nonce || !verifier || typeof f.remember !== 'boolean' || (f.registrationToken !== null && token === null)) return null;
    return { state, nonce, verifier, remember: f.remember, registrationToken: token };
  } catch {
    return null;
  }
}

const sameEmail = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

async function linkSub(c: AdminLoginContext, admin: AdminRow, sub: string): Promise<void> {
  const account = await c.store.ensureAdminAccount(admin.id);
  await c.store.updateAdminAccount(account.id, { googleSub: sub });
  await c.store.record({ subjectType: 'admin', subjectId: String(admin.id), action: SECURITY_ACTIONS.googleLinked, changes: {}, actor: 'sistem' });
}

/** The admin of a Google identity: the account that holds the sub, or the one of the same e-mail that holds none (then the sub is stored). Never creates one. */
async function adminOfGoogle(c: AdminLoginContext, who: GoogleIdentity): Promise<AdminRow | null> {
  const owner = await c.store.adminAccountByGoogleSub(who.sub);
  if (owner) {
    const admin = await adminById(c.strapi, owner.adminUserId);
    return canEnterAdmin(admin) ? admin : null;
  }
  const admin = await adminByEmail(c.strapi, who.email);
  if (!canEnterAdmin(admin) || (await c.store.adminAccount(admin.id))?.googleSub) return null;
  await linkSub(c, admin, who.sub);
  return admin;
}

/** An invite accepted with Google: the Google e-mail must be the invited one, the sub must be free; the admin is registered with a random password. */
async function adminOfInvite(c: AdminLoginContext, who: GoogleIdentity, registrationToken: string): Promise<AdminRow | null> {
  const info = await adminUserService(c.strapi).findRegistrationInfo(registrationToken);
  if (!info || !sameEmail(info.email, who.email) || (await c.store.adminAccountByGoogleSub(who.sub))) return null;
  const admin = await registerInvited(c, registrationToken, randomPassword());
  if (!canEnterAdmin(admin)) return null;
  await linkSub(c, admin, who.sub);
  return admin;
}

async function identify(c: AdminLoginContext, g: GoogleClient, flow: Flow, code: string): Promise<GoogleIdentity | null> {
  const idToken = await exchangeCode(g, { code, codeVerifier: flow.verifier, redirectUri: redirectUri() });
  return idToken ? verifyIdToken(g, idToken, flow.nonce) : null;
}

async function enter(c: AdminLoginContext, flow: Flow, g: GoogleClient, code: string): Promise<AdminRow | null> {
  const who = await identify(c, g, flow, code);
  if (!who) return null;
  return flow.registrationToken ? adminOfInvite(c, who, flow.registrationToken) : adminOfGoogle(c, who);
}

/**
 * The way back from Google (spec 4.6). The state must match the cookie, the cookie is spent at once, the IP rule counts the attempt and the
 * e-mail lockout does not. Google logins skip 2FA. Every refusal is the same redirect (the invite page for an invite flow).
 */
export async function adminGoogleCallback(c: AdminLoginContext, query: Query, g: GoogleClient | null = googleClient()): Promise<{ redirect: string }> {
  const name = ADMIN_GOOGLE_COOKIE(c.secure);
  const flow = readFlow(c.cookie(name));
  c.clearCookie(name, ADMIN_GOOGLE_PATH);
  const [state, code] = [text(query.state), text(query.code, 2048)];
  if (!flow || !g || !state || !code || !sameHash(hashSecret(state), hashSecret(flow.state))) return failure(flow);
  if (await c.limits.ipBlocked(c.ip)) return failure(flow);
  try {
    const admin = await enter(c, flow, g, code);
    if (!admin) return failure(flow);
    const handoff = await finishAdminLogin(c, admin, flow.remember, { newDeviceMail: true, passkey: true });
    c.koa.cookies.set(JWT_COOKIE, handoff.accessToken, { httpOnly: false, sameSite: 'lax', secure: c.secure, path: '/', overwrite: true });
    return { redirect: `/intrare/gata?remember=${flow.remember ? '1' : '0'}` };
  } catch (err) {
    c.log(`[admin-google] failed: ${err instanceof Error ? err.name : 'error'}`);
    return failure(flow);
  }
}
