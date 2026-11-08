import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { describe, expect, it, vi } from 'vitest';
import { clearGoogleKeyCache, type GoogleClient } from '../../portal/auth/google';
import { SECURITY_ACTIONS } from '../../security/copy';
import { ADMIN_GOOGLE_COOKIE, ADMIN_GOOGLE_PATH, adminGoogleCallback, startAdminGoogle } from '../google';
import { loginEnv } from './login-env';

const CLIENT_ID = 'client-1.apps.googleusercontent.com';
const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...pair.publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
const COOKIE = ADMIN_GOOGLE_COOKIE(false);
const FAILED = '/intrare?eroare=google';
const FAILED_INVITE = '/intrare/invitatie?eroare=google';

function googleEnv() {
  clearGoogleKeyCache();
  const env = loginEnv();
  const nowSec = () => Math.floor(env.clock.t.getTime() / 1000);
  let claims: Record<string, unknown> = {};
  const fetchFn = vi.fn(async (url: unknown) => {
    if (String(url).startsWith('https://oauth2.googleapis.com/token')) {
      const token = jwt.sign(
        { iss: 'https://accounts.google.com', aud: CLIENT_ID, sub: 'sub-1', email: 'ana@x.ro', email_verified: true, nonce: flowNonce(), iat: nowSec(), exp: nowSec() + 3600, ...claims },
        pair.privateKey, { algorithm: 'RS256', keyid: 'k1' },
      );
      return new Response(JSON.stringify({ id_token: token }), { status: 200 });
    }
    return new Response(JSON.stringify({ keys: [jwk] }), { status: 200, headers: { 'cache-control': 'public, max-age=3000' } });
  }) as unknown as typeof fetch;
  const g: GoogleClient = { clientId: CLIENT_ID, clientSecret: 's', fetchFn, now: () => env.clock.t };
  env.addAdmin({ id: 7, email: 'Ana@X.ro', firstname: 'Ana', lastname: 'Pop', password: 'hash:p' });
  const flowOf = () => JSON.parse(Buffer.from(String(env.jar.get(COOKIE)), 'base64url').toString('utf8')) as { state: string; nonce: string; verifier: string; remember: boolean; registrationToken: string | null };
  function flowNonce(): string { return flowOf().nonce; }
  const started: { cookie: { options: Record<string, unknown> } | undefined } = { cookie: undefined };
  const start = (query: Record<string, unknown> = { remember: '1' }) => {
    const out = startAdminGoogle(env.c, query, g);
    started.cookie = env.sets.find((s) => s.name === COOKIE);
    env.sync();
    return out;
  };
  /** Start, then come back from Google with the given identity claims. */
  const run = async (identity: Record<string, unknown> = {}, o: { query?: Record<string, unknown>; state?: string } = {}) => {
    start(o.query);
    claims = identity;
    return adminGoogleCallback(env.c, { code: 'c1', state: o.state ?? flowOf().state }, g);
  };
  const adminCount = () => env.admins.length;
  return { ...env, g, fetchFn, start, run, flowOf, adminCount, started };
}

describe('startAdminGoogle', () => {
  it('redirects to Google with state, nonce, S256 challenge, the admin callback and scope "openid email", and keeps the flow in a 10-minute cookie on the callback path', () => {
    const env = googleEnv();
    const { redirect } = env.start({ remember: '1' });
    const url = new URL(redirect);
    expect(`${url.origin}${url.pathname}`).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    const flow = env.flowOf();
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: CLIENT_ID, redirect_uri: 'http://localhost:1337/api/admin-auth/google/callback', response_type: 'code', scope: 'openid email',
      state: flow.state, nonce: flow.nonce, code_challenge_method: 'S256',
    });
    expect(flow.remember).toBe(true);
    expect(flow.registrationToken).toBeNull();
    expect(env.started.cookie?.options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: ADMIN_GOOGLE_PATH, maxAge: 600_000 });
  });

  it('remember is 0 unless the query says 1; an invite token is kept in the cookie', () => {
    const env = googleEnv();
    env.start({});
    expect(env.flowOf().remember).toBe(false);
    env.start({ registrationToken: 'tok-1' });
    expect(env.flowOf().registrationToken).toBe('tok-1');
  });

  it('without a Google client it goes straight to the failure page', () => {
    const env = googleEnv();
    expect(startAdminGoogle(env.c, {}, null)).toEqual({ redirect: FAILED });
    expect(startAdminGoogle(env.c, { registrationToken: 'x'.repeat(300) }, env.g)).toEqual({ redirect: FAILED });
  });
});

describe('adminGoogleCallback', () => {
  it('a sub already linked logs in: the access token in a readable jwtToken cookie, the refresh cookie, the new-device mail, redirect with remember', async () => {
    const env = googleEnv();
    await env.c.store.updateAdminAccount((await env.c.store.ensureAdminAccount(7)).id, { googleSub: 'sub-1' });
    const out = await env.run({ email: 'other@x.ro' });
    expect(out).toEqual({ redirect: '/intrare/gata?remember=1' });
    const jwtSet = env.sets.find((s) => s.name === 'jwtToken');
    expect(jwtSet?.value).toEqual(expect.any(String));
    expect(jwtSet?.options).toMatchObject({ httpOnly: false, path: '/', sameSite: 'lax', maxAge: 60_000 });
    expect(env.sets.find((s) => s.name === 'strapi_admin_refresh')).toBeDefined();
    expect(env.sessions.rows[0].type).toBe('refresh');
    await env.flush();
    expect(env.portalMails.filter((m) => m.mail.kind === 'new-device')).toHaveLength(1);
    expect(env.sets.filter((s) => s.name === COOKIE).pop()).toMatchObject({ value: '', options: { path: ADMIN_GOOGLE_PATH } });
  });

  it('an e-mail match (case-insensitive) on an account with no sub stores the sub and writes "Google conectat."', async () => {
    const env = googleEnv();
    expect(await env.run({ email: 'ana@x.ro' })).toEqual({ redirect: '/intrare/gata?remember=1' });
    expect((await env.c.store.adminAccount(7))?.googleSub).toBe('sub-1');
    expect(env.mem.history.map((h) => h.action)).toEqual([SECURITY_ACTIONS.googleLinked]);
  });

  it('remember 0 gives a session-type family and remember=0', async () => {
    const env = googleEnv();
    expect(await env.run({}, { query: { remember: '0' } })).toEqual({ redirect: '/intrare/gata?remember=0' });
    expect(env.sessions.rows[0].type).toBe('session');
  });

  it('an e-mail match is refused when the account already has another sub', async () => {
    const env = googleEnv();
    await env.c.store.updateAdminAccount((await env.c.store.ensureAdminAccount(7)).id, { googleSub: 'sub-other' });
    expect(await env.run()).toEqual({ redirect: FAILED });
    expect((await env.c.store.adminAccount(7))?.googleSub).toBe('sub-other');
    expect(env.sessions.rows).toHaveLength(0);
  });

  it('an inactive or a blocked admin is refused, by e-mail and by sub', async () => {
    for (const patch of [{ isActive: false }, { blocked: true }]) {
      const env = googleEnv();
      Object.assign(env.admins[0], patch);
      expect(await env.run()).toEqual({ redirect: FAILED });
      await env.c.store.updateAdminAccount((await env.c.store.ensureAdminAccount(7)).id, { googleSub: 'sub-1' });
      expect(await env.run({ email: 'else@x.ro' })).toEqual({ redirect: FAILED });
      expect(env.sessions.rows).toHaveLength(0);
    }
  });

  it('an unknown e-mail is refused and no admin is created', async () => {
    const env = googleEnv();
    const before = env.adminCount();
    expect(await env.run({ email: 'nobody@x.ro', sub: 'sub-9' })).toEqual({ redirect: FAILED });
    expect(env.adminCount()).toBe(before);
    expect(await env.c.store.adminAccountByGoogleSub('sub-9')).toBeNull();
  });

  it('a wrong state is refused and Google is never called; no cookie is refused too', async () => {
    const env = googleEnv();
    expect(await env.run({}, { state: 'forged' })).toEqual({ redirect: FAILED });
    expect(env.fetchFn).not.toHaveBeenCalled();
    expect(await adminGoogleCallback(env.c, { code: 'c1', state: 'x' }, env.g)).toEqual({ redirect: FAILED });
    expect(env.sessions.rows).toHaveLength(0);
  });

  it('the flow cookie is spent: a replay of the same callback is refused', async () => {
    const env = googleEnv();
    env.start();
    const { state } = env.flowOf();
    expect((await adminGoogleCallback(env.c, { code: 'c1', state }, env.g)).redirect).toMatch(/^\/intrare\/gata/);
    env.sync();
    expect(await adminGoogleCallback(env.c, { code: 'c1', state }, env.g)).toEqual({ redirect: FAILED });
  });

  it('L2: the Google link line names the person as actor', async () => {
    const env = googleEnv();
    await env.run();
    expect(env.mem.history.find((h) => h.action === SECURITY_ACTIONS.googleLinked)).toMatchObject({ actor: 'Ana Pop' });
  });

  it('a token with a wrong nonce or an unverified e-mail is refused', async () => {
    const env = googleEnv();
    expect(await env.run({ nonce: 'other' })).toEqual({ redirect: FAILED });
    expect(await env.run({ email_verified: false })).toEqual({ redirect: FAILED });
    expect(env.sessions.rows).toHaveLength(0);
  });

  it('2FA on is skipped: a session at once', async () => {
    const env = googleEnv();
    await env.turnOnTotp();
    expect(await env.run()).toEqual({ redirect: '/intrare/gata?remember=1' });
    expect(env.sessions.rows).toHaveLength(1);
    expect(env.sets.find((s) => s.name === 'es_adm_2fa')).toBeUndefined();
  });

  it('is not counted by the e-mail lockout, but by the IP rule (the 31st is refused)', async () => {
    const env = googleEnv();
    await env.run();
    expect(env.portal.state.limits.map((l) => l.key).filter((k) => k.startsWith('login:'))).toEqual([]);
    for (let i = 0; i < 29; i += 1) await env.run({ email: 'nobody@x.ro' });
    expect(await env.run()).toEqual({ redirect: FAILED });
  });

  it('a failing Google call is logged by error name and refused, never thrown', async () => {
    const env = googleEnv();
    env.start();
    const broken = { ...env.g, fetchFn: (async () => { throw new TypeError('boom'); }) as unknown as typeof fetch };
    expect(await adminGoogleCallback(env.c, { code: 'c', state: env.flowOf().state }, broken)).toEqual({ redirect: FAILED });
    expect(env.logs).toContain('[admin-google] failed: TypeError');
  });
});

describe('invite with Google', () => {
  const inviteEnv = () => {
    const env = googleEnv();
    env.addAdmin({ id: 20, email: 'nou@x.ro', firstname: 'Nou', lastname: 'Venit', isActive: false, password: null, registrationToken: 'tok-1' });
    return env;
  };
  const query = { registrationToken: 'tok-1', remember: '0' };

  it('the same e-mail registers with a random 64-character password, links the sub and logs in', async () => {
    const env = inviteEnv();
    const spy = vi.spyOn(env.userService, 'updateById');
    expect(await env.run({ email: 'nou@x.ro', sub: 'sub-20' }, { query })).toEqual({ redirect: '/intrare/gata?remember=0' });
    const given = String(spy.mock.calls[0][1].password);
    expect(given).toHaveLength(64);
    expect(env.admins[1]).toMatchObject({ isActive: true, registrationToken: null });
    expect((await env.c.store.adminAccount(20))?.googleSub).toBe('sub-20');
    expect(env.sessions.rows).toHaveLength(1);
    await env.flush();
    expect(env.mem.history.map((h) => h.action)).toContain(SECURITY_ACTIONS.googleLinked);
  });

  it('another Google e-mail is refused to the invite page, and the invite stays open', async () => {
    const env = inviteEnv();
    expect(await env.run({ email: 'ana@x.ro' }, { query })).toEqual({ redirect: FAILED_INVITE });
    expect(env.admins[1].registrationToken).toBe('tok-1');
    expect(env.sessions.rows).toHaveLength(0);
  });

  it('an unknown or used token is refused to the invite page', async () => {
    const env = inviteEnv();
    expect(await env.run({ email: 'nou@x.ro' }, { query: { registrationToken: 'unknown' } })).toEqual({ redirect: FAILED_INVITE });
  });

  it('a sub that already belongs to another admin is refused', async () => {
    const env = inviteEnv();
    await env.c.store.updateAdminAccount((await env.c.store.ensureAdminAccount(7)).id, { googleSub: 'sub-20' });
    expect(await env.run({ email: 'nou@x.ro', sub: 'sub-20' }, { query })).toEqual({ redirect: FAILED_INVITE });
    expect(env.admins[1].registrationToken).toBe('tok-1');
  });

  it('M3 and L8: an invite older than 7 days, or of a blocked user, is refused to the invite page and stays unregistered', async () => {
    const stale = inviteEnv();
    stale.advance(7 * 24 * 3600_000 + 1000);
    expect(await stale.run({ email: 'nou@x.ro', sub: 'sub-20' }, { query })).toEqual({ redirect: FAILED_INVITE });
    expect(stale.admins[1]).toMatchObject({ registrationToken: 'tok-1', isActive: false });
    const blocked = inviteEnv();
    blocked.admins[1].blocked = true;
    expect(await blocked.run({ email: 'nou@x.ro', sub: 'sub-20' }, { query })).toEqual({ redirect: FAILED_INVITE });
    expect(blocked.admins[1]).toMatchObject({ registrationToken: 'tok-1', isActive: false });
  });
});
