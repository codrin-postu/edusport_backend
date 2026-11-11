import { createPublicKey } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { refuse, type AdminResult, type AuthRefusal } from '../../admin-result';
import { PORTAL_ERRORS, googleOtherEmail } from '../copy';
import { normalizeEmail } from '../limits';
import type { AccountRow } from '../store';
import { hashSecret, tokenState } from '../tokens';
import type { PortalAuthContext, PortalResult } from './context';
import { activateInvited, liveInvite } from './invite';
import { mayEnter, startSession } from './issue';
import { hasTwoFactor } from '../../security/second-step';
import { openSecondStep, portalSubject, withOffer, type PortalPending, type SessionWithOffer } from './two-factor';

export type GoogleClient = { clientId: string; clientSecret: string; fetchFn: typeof fetch; now: () => Date };
export type GoogleIdentity = { sub: string; email: string };

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const KEYS_MAX_AGE_S = 24 * 3600;
const FIELD_MAX = 2048;
const DEVICE_KEY_MAX = 200;
const SECRET_MAX = 200;
const CALL_TIMEOUT_MS = 10_000;

export function googleClient(env: NodeJS.ProcessEnv = process.env): GoogleClient | null {
  const clientId = env.PORTAL_GOOGLE_CLIENT_ID;
  const clientSecret = env.PORTAL_GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, fetchFn: (input, init) => fetch(input, init), now: () => new Date() };
}

export const googleConfig = (g: GoogleClient | null): AdminResult<{ clientId: string | null }> => ({ ok: true, data: { clientId: g ? g.clientId : null } });

/** The ID token for the code, or null when Google refuses it. A network failure or a 5xx throws (answered 502). */
export async function exchangeCode(g: GoogleClient, i: { code: string; codeVerifier: string; redirectUri: string }): Promise<string | null> {
  const res = await g.fetchFn(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    body: new URLSearchParams({
      grant_type: 'authorization_code', code: i.code, code_verifier: i.codeVerifier, redirect_uri: i.redirectUri, client_id: g.clientId, client_secret: g.clientSecret,
    }).toString(),
  });
  if (res.status >= 500) throw new Error('google token endpoint unavailable');
  if (!res.ok) return null;
  const json = (await res.json()) as { id_token?: unknown };
  return typeof json.id_token === 'string' && json.id_token !== '' ? json.id_token : null;
}

type Jwk = Record<string, unknown> & { kid?: string };
type KeyCache = { keys: Map<string, Jwk>; expiresAt: number };
/** Shared by every request: the controller builds a client per request, so the cache cannot live on it. */
const caches = new Map<string, KeyCache>();

export const clearGoogleKeyCache = (): void => caches.clear();

async function keyFor(g: GoogleClient, kid: string): Promise<Jwk | null> {
  const cached = caches.get(CERTS_URL);
  if (cached && cached.expiresAt > g.now().getTime() && cached.keys.has(kid)) return cached.keys.get(kid) ?? null;
  const res = await g.fetchFn(CERTS_URL, { signal: AbortSignal.timeout(CALL_TIMEOUT_MS) });
  if (!res.ok) throw new Error('google keys unavailable');
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1] ?? 0);
  const body = (await res.json()) as { keys?: Jwk[] };
  const keys = new Map<string, Jwk>();
  for (const k of body.keys ?? []) if (typeof k.kid === 'string') keys.set(k.kid, k);
  caches.set(CERTS_URL, { keys, expiresAt: g.now().getTime() + Math.min(maxAge, KEYS_MAX_AGE_S) * 1000 });
  return keys.get(kid) ?? null;
}

/** The identity of a valid ID token, or null for any check that fails. A key fetch failure throws. */
export async function verifyIdToken(g: GoogleClient, idToken: string, nonce: string): Promise<GoogleIdentity | null> {
  const decoded = jwt.decode(idToken, { complete: true });
  const kid = decoded && typeof decoded === 'object' ? decoded.header.kid : undefined;
  if (typeof kid !== 'string') return null;
  const jwk = await keyFor(g, kid);
  if (!jwk) return null;
  try {
    const key = createPublicKey({ key: jwk as never, format: 'jwk' });
    const payload = jwt.verify(idToken, key, {
      algorithms: ['RS256'], audience: g.clientId, issuer: ISSUERS as [string, string], clockTimestamp: Math.floor(g.now().getTime() / 1000),
    });
    if (typeof payload !== 'object' || payload.nonce !== nonce || payload.email_verified !== true || typeof payload.sub !== 'string' || payload.sub === '') return null;
    const email = normalizeEmail(payload.email);
    return email ? { sub: payload.sub, email } : null;
  } catch {
    return null;
  }
}

type GoogleBody = { host: string; code: string; codeVerifier: string; redirectUri: string; nonce: string; invite: string | null; deviceKey: string | null };

const text = (v: unknown, max = FIELD_MAX): string | null => (typeof v === 'string' && v !== '' && v.length <= max ? v : null);

function readBody(body: unknown, hosts: string[]): GoogleBody | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  const host = text(b.host);
  const code = text(b.code);
  const codeVerifier = text(b.codeVerifier);
  const redirectUri = text(b.redirectUri);
  const nonce = text(b.nonce);
  const invite = b.invite === undefined || b.invite === null ? null : text(b.invite, SECRET_MAX);
  const deviceKey = b.deviceKey === undefined || b.deviceKey === null ? null : text(b.deviceKey, DEVICE_KEY_MAX);
  if (!host || !hosts.includes(host) || !code || !codeVerifier || !redirectUri || !nonce) return null;
  if ((b.invite !== undefined && b.invite !== null && invite === null) || (b.deviceKey !== undefined && b.deviceKey !== null && deviceKey === null)) return null;
  return { host, code, codeVerifier, redirectUri, nonce, invite, deviceKey };
}

const paused: AuthRefusal = { ok: false, status: 429, error: PORTAL_ERRORS.paused };
const noAccount: AuthRefusal = { ok: false, status: 401, error: PORTAL_ERRORS.googleNoAccount };
const unreachable: AuthRefusal = { ok: false, status: 502, error: PORTAL_ERRORS.loadFailed };
const expiredInvite: AuthRefusal = { ok: false, status: 410, error: PORTAL_ERRORS.inviteExpired };

/** One transaction under the account lock: invite still valid, sub stored, account active through `activateInvited`. */
async function acceptWithGoogle(c: PortalAuthContext, accountId: string, tokenId: string, sub: string): Promise<AccountRow | null> {
  return c.store.transaction(async () => {
    await c.store.lockAccount(accountId);
    const account = await c.store.account(accountId);
    const token = (await c.store.tokens(accountId, 'invite')).find((t) => t.id === tokenId);
    if (!account || account.status !== 'invited' || !token || tokenState(token, c.now()) !== 'valid') return null;
    await c.store.updateAccount(accountId, { googleSub: sub });
    await activateInvited(c, account, 'google', token);
    return { ...account, status: 'active', googleSub: sub };
  });
}

/** The first Google login of an active account that has no sub yet; false when it got one meanwhile. */
async function bindSub(c: PortalAuthContext, accountId: string, sub: string, host: string): Promise<AccountRow | null> {
  return c.store.transaction(async () => {
    await c.store.lockAccount(accountId);
    const account = await c.store.account(accountId);
    if (!account || account.status !== 'active' || account.googleSub !== null || account.googleUnlinkedAt !== null) return null;
    if (!(await mayEnter(c, account, await c.store.user(account.userId), host))) return null;
    await c.store.updateAccount(accountId, { googleSub: sub });
    return { ...account, googleSub: sub };
  });
}

async function latestInviteToken(c: PortalAuthContext, accountId: string): Promise<string | null> {
  const valid = (await c.store.tokens(accountId, 'invite')).filter((t) => tokenState(t, c.now()) === 'valid');
  return valid.length > 0 ? valid[valid.length - 1].id : null;
}

async function identify(g: GoogleClient, read: GoogleBody): Promise<GoogleIdentity | null> {
  const idToken = await exchangeCode(g, read);
  return idToken ? verifyIdToken(g, idToken, read.nonce) : null;
}

/**
 * Google sign-in (spec 4.6). A sub already linked skips 2FA (user decision). The first link by e-mail of an account with any 2FA method opens
 * the pending second step with the sub in the pending data and stores it only after a right code; an account whose link was removed (an e-mail
 * change) is never re-linked by e-mail. An account without 2FA links at once.
 */
export async function loginWithGoogle(c: PortalAuthContext, g: GoogleClient | null, body: unknown): Promise<PortalResult<SessionWithOffer | PortalPending>> {
  const read = readBody(body, c.hosts);
  if (!read) return refuse(400, PORTAL_ERRORS.invalid);
  if (await c.limits.ipBlocked(c.ip)) return paused;
  if (!g) return unreachable;
  let who: GoogleIdentity | null;
  try {
    who = await identify(g, read);
  } catch (err) {
    c.log(`[portal-google] google unreachable: ${err instanceof Error ? err.name : 'error'}`);
    return unreachable;
  }
  if (!who) return noAccount;
  const session = async (account: AccountRow, notifyNewDevice: boolean) => withOffer(c, account, await startSession(c, account, read.deviceKey, { notifyNewDevice, host: read.host }));
  const enter = async (account: AccountRow | null): Promise<PortalResult<SessionWithOffer>> => {
    if (!account) return noAccount;
    const user = await c.store.user(account.userId);
    return (await mayEnter(c, account, user, read.host)) ? session(account, false) : noAccount;
  };

  const owner = await c.store.accountByGoogleSub(who.sub);
  if (read.invite !== null) {
    const live = await liveInvite(c, read.invite);
    if (!live) return expiredInvite;
    if (live.account.email !== who.email) return { ok: false, status: 401, error: googleOtherEmail(live.account.email) };
    if (owner && owner.id !== live.account.id) return noAccount;
    const done = await acceptWithGoogle(c, live.account.id, live.token.id, who.sub);
    return done ? enter(done) : expiredInvite;
  }
  if (owner) {
    const user = await c.store.user(owner.userId);
    return (await mayEnter(c, owner, user, read.host)) ? session(owner, true) : noAccount;
  }
  const byEmail = await c.store.accountByEmail(who.email);
  if (!byEmail || byEmail.status === 'disabled' || byEmail.googleSub !== null || byEmail.googleUnlinkedAt !== null) return noAccount;
  if (byEmail.status === 'invited') {
    const tokenId = await latestInviteToken(c, byEmail.id);
    if (!tokenId) return expiredInvite;
    const done = await acceptWithGoogle(c, byEmail.id, tokenId, who.sub);
    return done ? enter(done) : expiredInvite;
  }
  if ((await hasTwoFactor(c.security, portalSubject(byEmail))).length > 0) {
    if (!(await mayEnter(c, byEmail, await c.store.user(byEmail.userId), read.host))) return noAccount;
    const device = read.deviceKey ? await c.store.deviceByKey(byEmail.id, hashSecret(read.deviceKey), read.host) : null;
    return openSecondStep(c, byEmail, read.deviceKey, read.host, device, who.sub);
  }
  const bound = await bindSub(c, byEmail.id, who.sub, read.host);
  return bound ? session(bound, true) : noAccount;
}
