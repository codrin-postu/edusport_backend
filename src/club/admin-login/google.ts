import { createHash, randomBytes } from 'node:crypto';
import { exchangeCode, googleClient, verifyIdToken, type GoogleClient, type GoogleIdentity } from '../portal/auth/google';
import { hashSecret, sameHash } from '../portal/tokens';
import { hasTwoFactor } from '../security/second-step';
import { adminByEmail, adminById, canEnterAdmin, type AdminRow } from './admins';
import { adminOrigin, type AdminLoginContext } from './context';
import { openInvite, randomPassword, registerInvited } from './invite';
import { canLinkByEmail, linkAdminGoogle } from './google-link';
import { finishAdminLogin, startSecondStep } from './login';

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
/** The page script (T16) reads the cookie and deletes it at once; whatever it leaves behind is gone after a minute. */
const JWT_COOKIE_MS = 60_000;

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

/** Who a Google identity is: `admin` enters now, `second` must first pass 2FA (the sub is stored only after a right code), null is the one refusal. */
type Entry = { admin: AdminRow; sub: string | null; second: boolean };

/**
 * The admin of a Google identity: the account that holds the sub (2FA skipped, user decision), or, on the first link only, the one of the same e-mail that
 * holds none and never had its link removed. A first link of an admin with 2FA opens the second step and stores nothing yet (B4 H1). Never creates one.
 */
async function adminOfGoogle(c: AdminLoginContext, who: GoogleIdentity): Promise<Entry | null> {
  const owner = await c.store.adminAccountByGoogleSub(who.sub);
  if (owner) {
    const admin = await adminById(c.strapi, owner.adminUserId);
    return canEnterAdmin(admin) ? { admin, sub: null, second: false } : null;
  }
  const admin = await adminByEmail(c.strapi, who.email);
  if (!canEnterAdmin(admin) || !(await canLinkByEmail(c, admin))) return null;
  if ((await hasTwoFactor(c, { type: 'admin', id: String(admin.id) })).length > 0) return { admin, sub: who.sub, second: true };
  await linkAdminGoogle(c, admin, who.sub);
  return { admin, sub: null, second: false };
}

/** An invite accepted with Google: the Google e-mail must be the invited one, the sub must be free; the admin is registered with a random password. */
async function adminOfInvite(c: AdminLoginContext, who: GoogleIdentity, registrationToken: string): Promise<AdminRow | null> {
  const info = await openInvite(c, registrationToken);
  if (!info || !sameEmail(info.email, who.email) || (await c.store.adminAccountByGoogleSub(who.sub))) return null;
  const admin = await registerInvited(c, registrationToken, randomPassword());
  if (!canEnterAdmin(admin)) return null;
  await linkAdminGoogle(c, admin, who.sub);
  return admin;
}

async function identify(c: AdminLoginContext, g: GoogleClient, flow: Flow, code: string): Promise<GoogleIdentity | null> {
  const idToken = await exchangeCode(g, { code, codeVerifier: flow.verifier, redirectUri: redirectUri() });
  return idToken ? verifyIdToken(g, idToken, flow.nonce) : null;
}

async function enter(c: AdminLoginContext, flow: Flow, g: GoogleClient, code: string): Promise<Entry | null> {
  const who = await identify(c, g, flow, code);
  if (!who) return null;
  if (!flow.registrationToken) return adminOfGoogle(c, who);
  const admin = await adminOfInvite(c, who, flow.registrationToken);
  return admin ? { admin, sub: null, second: false } : null;
}

/**
 * The way back from Google (spec 4.6). The state must match the cookie, the cookie is spent at once, the IP rule counts the attempt and the
 * e-mail lockout does not. A linked Google login skips 2FA; the first link of an admin with 2FA asks for it. Every refusal is the same redirect (the invite page for an invite flow).
 */
export async function adminGoogleCallback(c: AdminLoginContext, query: Query, g: GoogleClient | null = googleClient()): Promise<{ redirect: string }> {
  const name = ADMIN_GOOGLE_COOKIE(c.secure);
  const flow = readFlow(c.cookie(name));
  c.clearCookie(name, ADMIN_GOOGLE_PATH);
  const [state, code] = [text(query.state), text(query.code, 2048)];
  if (!flow || !g || !state || !code || !sameHash(hashSecret(state), hashSecret(flow.state))) return failure(flow);
  if (await c.limits.ipBlocked(c.ip)) return failure(flow);
  try {
    const entry = await enter(c, flow, g, code);
    if (!entry) return failure(flow);
    if (entry.second) {
      const step = await startSecondStep(c, entry.admin, flow.remember, entry.sub ?? undefined);
      if (!step.ok) return failure(flow);
      return { redirect: `/intrare/2fa?via=google&last=${step.data.last}&methods=${step.data.methods.join(',')}` };
    }
    const admin = entry.admin;
    const handoff = await finishAdminLogin(c, admin, flow.remember, { newDeviceMail: true, passkey: true });
    c.koa.cookies.set(JWT_COOKIE, handoff.accessToken, { httpOnly: false, sameSite: 'lax', secure: c.secure, path: '/', overwrite: true, maxAge: JWT_COOKIE_MS });
    return { redirect: `/intrare/gata?remember=${flow.remember ? '1' : '0'}` };
  } catch (err) {
    c.log(`[admin-google] failed: ${err instanceof Error ? err.name : 'error'}`);
    return failure(flow);
  }
}
