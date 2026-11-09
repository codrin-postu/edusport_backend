import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Webauthn } from '../../admin/lib/webauthn';
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
  it('is its own screen at /login/passkey with the approved texts and flat buttons', () => {
    expect(screenOf('/login/passkey')).toBe('offer');
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

describe('the browser layer (official library, mocked)', () => {
  const lib = vi.hoisted(() => ({
    startAuthentication: vi.fn(async () => ({ id: 'auth' })),
    startRegistration: vi.fn(async () => ({ id: 'reg' })),
    cancelCeremony: vi.fn(),
    supported: vi.fn(() => true),
    autofill: vi.fn(async () => true),
    platform: vi.fn(async () => true),
  }));
  vi.mock('@simplewebauthn/browser', () => ({
    startAuthentication: lib.startAuthentication,
    startRegistration: lib.startRegistration,
    browserSupportsWebAuthn: lib.supported,
    browserSupportsWebAuthnAutofill: lib.autofill,
    platformAuthenticatorIsAvailable: lib.platform,
    WebAuthnAbortService: { cancelCeremony: lib.cancelCeremony },
  }));

  it('passes the server options through and asks for browser autofill only for the conditional request', async () => {
    const { browserWebauthn } = await import('../../admin/lib/webauthn');
    const wa = browserWebauthn();
    expect(wa.supported).toBe(true);
    expect(await wa.authenticate({ challenge: 'AA' })).toEqual({ id: 'auth' });
    expect(lib.startAuthentication).toHaveBeenLastCalledWith({ optionsJSON: { challenge: 'AA' }, useBrowserAutofill: false });
    await wa.authenticate({ challenge: 'AA' }, { conditional: true });
    expect(lib.startAuthentication).toHaveBeenLastCalledWith({ optionsJSON: { challenge: 'AA' }, useBrowserAutofill: true });
    expect(await wa.register({ challenge: 'BB' })).toEqual({ id: 'reg' });
    expect(lib.startRegistration).toHaveBeenLastCalledWith({ optionsJSON: { challenge: 'BB' } });
  });

  it('aborting the signal cancels the running ceremony', async () => {
    const { browserWebauthn } = await import('../../admin/lib/webauthn');
    const control = new AbortController();
    let release: (v: unknown) => void = () => undefined;
    lib.startAuthentication.mockImplementationOnce(() => new Promise((r) => { release = r; }) as never);
    const run = browserWebauthn().authenticate({}, { conditional: true, signal: control.signal });
    control.abort();
    expect(lib.cancelCeremony).toHaveBeenCalledTimes(1);
    release({ id: 'x' });
    await run;
  });

  it('capability checks answer false when the library throws', async () => {
    const { browserWebauthn } = await import('../../admin/lib/webauthn');
    lib.autofill.mockRejectedValueOnce(new Error('x'));
    lib.platform.mockResolvedValueOnce(false);
    const wa = browserWebauthn();
    expect(await wa.autofill()).toBe(false);
    expect(await wa.platformKey()).toBe(false);
  });
});
