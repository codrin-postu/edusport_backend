import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  authenticationJson, autofillSupported, creationOptions, fromBase64Url, registrationJson, requestOptions, startAuthentication, toBase64Url,
  webauthnSupported, type Webauthn, type WebAuthnEnv,
} from '../../admin/lib/webauthn';
import type { AdminHandoff } from '../../club/security/api-types';
import { SECURITY_COPY, SECURITY_ERRORS } from '../../club/security/copy';
import type { Post } from '../api';
import type { Deps } from '../deps';
import { createOfferedKey, dismissOffer, signInWithKey } from '../flow';
import { screenOf } from '../route';
import { Login } from '../screens/Login';
import { Offer } from '../screens/Offer';

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const has = (markup: string, text: string): boolean => markup.includes(esc(text));

const fake = (over: Partial<Webauthn> = {}): Webauthn => ({
  supported: true, autofill: async () => true, platformKey: async () => true, register: async () => ({ id: 'new' }), authenticate: async () => ({ id: 'k1' }), ...over,
});
const deps = (over: Partial<Deps> = {}): Deps => ({
  post: vi.fn() as unknown as Post, go: vi.fn(), handoff: vi.fn(), search: '', flash: null, email: null, token: null, webauthn: fake(), ...over,
});
const html = (c: React.ComponentType<Deps>, over: Partial<Deps> = {}): string => renderToStaticMarkup(React.createElement(c, deps(over)));
const handoff: AdminHandoff = { accessToken: 'a.b.c', remember: false, offerPasskey: false };

/** Posts answer by path; every call is recorded. */
function posts(answers: Record<string, { ok: true; data: unknown } | { ok: false; status: number; message: string }>) {
  const calls: Array<{ path: string; body: unknown }> = [];
  const post = (async (path: string, body: unknown) => {
    calls.push({ path, body });
    return answers[path] ?? { ok: false, status: 500, message: 'x' };
  }) as unknown as Post;
  return { post, calls };
}

describe('the sign-in page with keys', () => {
  it('shows the button and the autofill field only when the browser supports keys', () => {
    const on = html(Login);
    expect(has(on, SECURITY_COPY.login.passkey)).toBe(true);
    expect(on).toContain('autoComplete="username webauthn"');
    const off = html(Login, { webauthn: fake({ supported: false }) });
    expect(has(off, SECURITY_COPY.login.passkey)).toBe(false);
    expect(off).not.toContain('webauthn');
  });

  it('a cancelled dialog shows "Nu am putut folosi cheia de acces."', async () => {
    const { post } = posts({ '/api/admin-auth/passkey/options': { ok: true, data: { options: { challenge: 'AA' } } } });
    const next = await signInWithKey(post, fake({ authenticate: async () => { throw new Error('NotAllowedError'); } }), false);
    expect(next).toEqual({ kind: 'error', message: SECURITY_ERRORS.passkeyFailed });
  });

  it('an aborted autofill request ends quietly', async () => {
    const { post } = posts({ '/api/admin-auth/passkey/options': { ok: true, data: { options: {} } } });
    const control = new AbortController();
    control.abort();
    const next = await signInWithKey(post, fake({ authenticate: async () => { throw new Error('AbortError'); } }), false, { conditional: true, signal: control.signal });
    expect(next).toBeNull();
  });

  it('sends { response, rememberMe } to verify and hands the session over; the server text of a 401 is shown as sent', async () => {
    const ok = posts({ '/api/admin-auth/passkey/options': { ok: true, data: { options: { challenge: 'AA' } } }, '/api/admin-auth/passkey/verify': { ok: true, data: handoff } });
    expect(await signInWithKey(ok.post, fake(), true)).toEqual({ kind: 'handoff', handoff });
    expect(ok.calls[1]).toEqual({ path: '/api/admin-auth/passkey/verify', body: { response: { id: 'k1' }, rememberMe: true } });
    const refused = posts({
      '/api/admin-auth/passkey/options': { ok: true, data: { options: {} } },
      '/api/admin-auth/passkey/verify': { ok: false, status: 401, message: SECURITY_ERRORS.passkeyOtherKind },
    });
    expect(await signInWithKey(refused.post, fake(), false)).toEqual({ kind: 'error', message: SECURITY_ERRORS.passkeyOtherKind });
  });

  it('the button flow passes no conditional mediation, the autofill flow does', async () => {
    const authenticate = vi.fn(async () => ({ id: 'k1' }));
    const { post } = posts({ '/api/admin-auth/passkey/options': { ok: true, data: { options: { challenge: 'AA' } } }, '/api/admin-auth/passkey/verify': { ok: true, data: handoff } });
    await signInWithKey(post, fake({ authenticate }), false, {});
    await signInWithKey(post, fake({ authenticate }), false, { conditional: true });
    expect(authenticate.mock.calls[0][1]).toEqual({});
    expect(authenticate.mock.calls[1][1]).toEqual({ conditional: true });
  });
});

describe('the offer', () => {
  it('is its own screen at /intrare/cheie with the approved texts and flat buttons', () => {
    expect(screenOf('/intrare/cheie')).toBe('offer');
    const m = html(Offer, { token: 'tok' });
    for (const t of [SECURITY_COPY.offer.title, SECURITY_COPY.offer.line, SECURITY_COPY.offer.create, SECURITY_COPY.offer.notNow]) expect(has(m, t), t).toBe(true);
    expect(m.match(/class="[^"]*\bpce\b/g)?.length).toBe(2);
    expect(html(Offer, { token: null })).toBe('');
  });

  it('"Creează" runs options, the dialog and register; a cancelled dialog gives the failure text and registers nothing', async () => {
    const ok = posts({ '/api/admin-auth/me/passkeys/options': { ok: true, data: { options: {} } }, '/api/admin-auth/me/passkeys': { ok: true, data: { toast: 'x' } } });
    expect(await createOfferedKey(ok.post, fake())).toEqual({ ok: true });
    expect(ok.calls.map((c) => c.path)).toEqual(['/api/admin-auth/me/passkeys/options', '/api/admin-auth/me/passkeys']);
    const cancelled = posts({ '/api/admin-auth/me/passkeys/options': { ok: true, data: { options: {} } } });
    expect(await createOfferedKey(cancelled.post, fake({ register: async () => { throw new Error('x'); } }))).toEqual({ ok: false, message: SECURITY_ERRORS.passkeyFailed });
    expect(cancelled.calls).toHaveLength(1);
  });

  it('"Nu acum" posts the dismissal', async () => {
    const { post, calls } = posts({ '/api/admin-auth/me/passkey-offer/dismiss': { ok: true, data: { ok: true } } });
    await dismissOffer(post);
    expect(calls).toEqual([{ path: '/api/admin-auth/me/passkey-offer/dismiss', body: {} }]);
  });

  it('the offer and login sources use no raw button and no inline colours', () => {
    const dir = join(__dirname, '..', 'screens');
    for (const f of ['Offer.tsx', 'Login.tsx']) expect(readFileSync(join(dir, f), 'utf8'), f).not.toMatch(/<button|#[0-9a-fA-F]{3,6}\b/);
    expect(readdirSync(dir)).toContain('Offer.tsx');
  });
});

describe('the browser layer', () => {
  const env = (over: Partial<WebAuthnEnv> = {}): WebAuthnEnv => ({
    credentials: { create: vi.fn(), get: vi.fn() }, PublicKeyCredential: { isConditionalMediationAvailable: async () => true }, ...over,
  });

  it('base64url round trips and detects support', async () => {
    const bytes = new Uint8Array([251, 255, 0, 1, 2]).buffer;
    expect(toBase64Url(bytes)).toBe('-_8AAQI');
    expect(new Uint8Array(fromBase64Url('-_8AAQI'))).toEqual(new Uint8Array(bytes));
    expect(webauthnSupported(env())).toBe(true);
    expect(webauthnSupported({})).toBe(false);
    expect(await autofillSupported(env())).toBe(true);
    expect(await autofillSupported(env({ PublicKeyCredential: {} }))).toBe(false);
  });

  it('turns the server options into bytes for the browser', () => {
    const c = creationOptions({ challenge: 'AQID', user: { id: 'BAUG', name: 'a' }, excludeCredentials: [{ id: 'Bw', type: 'public-key' }], rp: { name: 'EduSport' } });
    expect(new Uint8Array(c.publicKey.challenge as ArrayBuffer)).toEqual(new Uint8Array([1, 2, 3]));
    expect(new Uint8Array((c.publicKey.user as { id: ArrayBuffer }).id)).toEqual(new Uint8Array([4, 5, 6]));
    expect(c.publicKey.rp).toEqual({ name: 'EduSport' });
    expect(new Uint8Array((c.publicKey.excludeCredentials as Array<{ id: ArrayBuffer }>)[0].id)).toEqual(new Uint8Array([7]));
    expect(requestOptions({ challenge: 'AQID' }).publicKey.allowCredentials).toEqual([]);
  });

  it('shapes the answers like the server expects, with transports and the user handle', () => {
    const buf = (...n: number[]): ArrayBuffer => new Uint8Array(n).buffer;
    const reg = registrationJson({ id: 'cred', rawId: buf(1), type: 'public-key', response: { clientDataJSON: buf(2), attestationObject: buf(3), getTransports: () => ['internal'] }, getClientExtensionResults: () => ({}) });
    expect(reg).toMatchObject({ id: 'cred', rawId: 'AQ', type: 'public-key', response: { clientDataJSON: 'Ag', attestationObject: 'Aw', transports: ['internal'] } });
    const auth = authenticationJson({ id: 'cred', rawId: buf(1), type: 'public-key', response: { clientDataJSON: buf(2), authenticatorData: buf(3), signature: buf(4), userHandle: buf(5) } });
    expect(auth).toMatchObject({ response: { authenticatorData: 'Aw', signature: 'BA', userHandle: 'BQ' } });
    expect(() => registrationJson(null)).toThrow();
  });

  it('conditional mediation and the abort signal reach navigator.credentials.get', async () => {
    const get = vi.fn(async () => ({ id: 'c', rawId: new Uint8Array([1]).buffer, type: 'public-key', response: { clientDataJSON: new ArrayBuffer(1), authenticatorData: new ArrayBuffer(1), signature: new ArrayBuffer(1) } }));
    const control = new AbortController();
    await startAuthentication({ challenge: 'AQ' }, { conditional: true, signal: control.signal }, env({ credentials: { create: vi.fn(), get } }));
    expect(get.mock.calls[0][0]).toMatchObject({ mediation: 'conditional', signal: control.signal });
  });
});
