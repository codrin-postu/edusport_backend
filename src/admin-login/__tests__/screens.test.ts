import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Webauthn } from '../../admin/lib/webauthn';
import type { AdminHandoff, SecondStep as SecondStepAnswer } from '../../club/security/api-types';
import { SECURITY_COPY, SECURITY_ERRORS } from '../../club/security/copy';
import { createPost, type Post } from '../api';
import type { Deps } from '../deps';
import {
  googleStartUrl, inviteGoogleUrl, NEW_SECOND_STEP, nextOf, parseSecondStepQuery, secondStepBody, secondStepUrl, submitInvite, submitLogin,
  submitResetConfirm, submitSecondStep,
} from '../flow';
import { screenOf } from '../route';
import { Invite } from '../screens/Invite';
import { Login } from '../screens/Login';
import { Reset } from '../screens/Reset';
import { SecondStep } from '../screens/SecondStep';

const noKeys: Webauthn = { supported: false, autofill: async () => false, platformKey: async () => false, register: async () => ({}), authenticate: async () => ({}) };
const dir = join(__dirname, '..');
const read = (p: string): string => readFileSync(join(dir, p), 'utf8');
const html = (c: React.ComponentType<Deps>, over: Partial<Deps> = {}): string =>
  renderToStaticMarkup(React.createElement(c, { post: vi.fn() as unknown as Post, go: vi.fn(), handoff: vi.fn(), search: '', flash: null, email: null, token: null, webauthn: noKeys, ...over }));
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const has = (markup: string, text: string): boolean => markup.includes(esc(text));

const handoff: AdminHandoff = { accessToken: 'a.b.c', remember: true, offerPasskey: false };
const step: SecondStepAnswer = { step: '2fa', methods: ['totp', 'backup'], last: 'totp', email: 'admin@example.invalid' };
const okPost = (data: unknown): Post => vi.fn(async () => ({ ok: true as const, data })) as unknown as Post;

describe('Login', () => {
  it('renders every string of the copy file exactly', () => {
    const m = html(Login);
    const C = SECURITY_COPY.login;
    for (const t of [C.title, C.brand, C.google, C.or, C.email, C.password, C.showPassword, C.remember, C.submit, C.forgot]) expect(has(m, t), t).toBe(true);
  });

  it('shows the Google refusal text for ?eroare=google and a carried flash text', () => {
    expect(has(html(Login, { search: '?eroare=google' }), SECURITY_ERRORS.googleNoAccount)).toBe(true);
    expect(has(html(Login, { flash: SECURITY_ERRORS.pendingExpired }), SECURITY_ERRORS.pendingExpired)).toBe(true);
  });

  it('submits { email, password, rememberMe } and shows the 401 text from the server as sent', async () => {
    const post = vi.fn(async () => ({ ok: false as const, status: 401, message: 'E-mailul sau parola nu sunt corecte.' }));
    const next = await submitLogin(post as unknown as Post, { email: ' admin1@example.invalid ', password: 'Throwaway-Admin-1', rememberMe: true });
    expect(post).toHaveBeenCalledWith('/api/admin-auth/login', { email: 'admin1@example.invalid', password: 'Throwaway-Admin-1', rememberMe: true });
    expect(next).toEqual({ kind: 'error', message: 'E-mailul sau parola nu sunt corecte.' });
  });

  it('a SecondStep answer routes to /login/2fa with last preselected and the e-mail carried', async () => {
    const next = await submitLogin(okPost(step), { email: 'a@example.invalid', password: 'x', rememberMe: false });
    expect(next).toEqual({ kind: 'secondStep', to: '/login/2fa?last=totp&methods=totp,backup', email: 'admin@example.invalid' });
    expect(parseSecondStepQuery('?last=totp&methods=totp,backup')).toEqual({ methods: ['totp', 'backup'], last: 'totp', viaGoogle: false });
  });

  it('a handoff answer is a handoff', async () => {
    expect(await submitLogin(okPost(handoff), { email: 'a@example.invalid', password: 'x', rememberMe: true })).toEqual({ kind: 'handoff', handoff });
  });

  it('the Google link carries "Ține-mă minte"', () => {
    expect(googleStartUrl(true)).toBe('/api/admin-auth/google/start?remember=1');
    expect(googleStartUrl(false)).toBe('/api/admin-auth/google/start?remember=0');
  });
});

describe('SecondStep', () => {
  it('defaults to "Ține minte dispozitivul" ticked and sends { method, code, remember: true }', async () => {
    expect(NEW_SECOND_STEP.remember).toBe(true);
    const post = okPost(handoff);
    await submitSecondStep(post, { method: 'totp', code: ' 123456 ', remember: NEW_SECOND_STEP.remember });
    expect(post).toHaveBeenCalledWith('/api/admin-auth/2fa', { method: 'totp', code: '123456', remember: true });
    expect(secondStepBody({ method: 'backup', code: 'ABCDE FGHJK', remember: false })).toEqual({ method: 'backup', code: 'ABCDE FGHJK', remember: false });
  });

  it('renders the app prompt, the field, the tick ticked, "Verifică", "Altă metodă" and the back link', () => {
    const m = html(SecondStep, { search: '?last=totp&methods=totp,email,backup' });
    const C = SECURITY_COPY.secondStep;
    for (const t of [C.title, C.appPrompt, C.appField, C.remember, C.verify, C.otherMethod, C.back]) expect(has(m, t), t).toBe(true);
    expect(m).toMatch(/type="checkbox"[^>]*checked/);
  });

  it('e-mail method: "Am trimis un cod pe <e-mail>.", the field and "Trimite din nou"', () => {
    const m = html(SecondStep, { search: '?last=email&methods=email,backup', email: 'admin@example.invalid' });
    const C = SECURITY_COPY.secondStep;
    for (const t of [C.emailSent('admin@example.invalid'), C.emailField, C.resend]) expect(has(m, t), t).toBe(true);
  });

  it('the Google first-link address (no e-mail in it) renders without the "sent to" line', () => {
    const q = parseSecondStepQuery('?via=google&last=email&methods=email,backup');
    expect(q).toEqual({ methods: ['email', 'backup'], last: 'email', viaGoogle: true });
    const m = html(SecondStep, { search: '?via=google&last=email&methods=email,backup' });
    expect(has(m, SECURITY_COPY.secondStep.emailField)).toBe(true);
    expect(m).not.toContain('undefined');
    expect(m).not.toContain('example.invalid');
  });

  it('a bad or missing method list is no second step; last falls back to the first method', () => {
    expect(parseSecondStepQuery('')).toBeNull();
    expect(parseSecondStepQuery('?methods=sms')).toBeNull();
    expect(parseSecondStepQuery('?last=email&methods=totp,backup')?.last).toBe('totp');
    expect(secondStepUrl({ methods: ['totp'], last: 'totp' }, 'google')).toBe('/login/2fa?last=totp&methods=totp&via=google');
  });

  it('an ended pending login (401) goes back to the password form with its text', async () => {
    const post = vi.fn(async () => ({ ok: false as const, status: 401, message: SECURITY_ERRORS.pendingExpired }));
    expect(await submitSecondStep(post as unknown as Post, { method: 'totp', code: '1', remember: true })).toEqual({ kind: 'expired', message: SECURITY_ERRORS.pendingExpired });
    expect(nextOf({ ok: false, status: 400, message: SECURITY_ERRORS.badCode }, true)).toEqual({ kind: 'error', message: SECURITY_ERRORS.badCode });
  });
});

describe('Invite and Reset', () => {
  it('Reset renders the e-mail field and "Trimite codul" first, and the back link', () => {
    const m = html(Reset);
    for (const t of [SECURITY_COPY.login.forgot, SECURITY_COPY.login.email, SECURITY_COPY.reset.sendCode, SECURITY_COPY.reset.back]) expect(has(m, t), t).toBe(true);
  });

  it('Invite posts the registration token and the password; the Google link carries the token', async () => {
    const post = okPost(handoff);
    await submitInvite(post, 'tok123', 'Throwaway-Admin-1');
    expect(post).toHaveBeenCalledWith('/api/admin-auth/invite/accept', { registrationToken: 'tok123', password: 'Throwaway-Admin-1' });
    expect(inviteGoogleUrl('a b')).toBe('/api/admin-auth/invite/google?registrationToken=a%20b');
    expect(html(Invite, { search: '?registrationToken=x' })).toBeTypeOf('string');
  });

  it('reset confirm posts { email, code, password } and may lead to the second step', async () => {
    const post = okPost(step);
    expect(await submitResetConfirm(post, { email: 'a@example.invalid ', code: ' 123456', password: 'Throwaway-Admin-1' })).toMatchObject({ kind: 'secondStep' });
    expect(post).toHaveBeenCalledWith('/api/admin-auth/reset/confirm', { email: 'a@example.invalid', code: '123456', password: 'Throwaway-Admin-1' });
  });
});

describe('api and routes', () => {
  it('createPost: data, refusal text as sent, and a network failure with the shared text', async () => {
    const reply = (status: number, body: unknown) => createPost(async () => ({ status, json: async () => body }));
    expect(await reply(200, { data: { a: 1 } })('/x', {})).toEqual({ ok: true, data: { a: 1 } });
    expect(await reply(429, { data: null, error: { message: SECURITY_ERRORS.paused } })('/x', {})).toEqual({ ok: false, status: 429, message: SECURITY_ERRORS.paused });
    expect(await createPost(async () => { throw new Error('offline'); })('/x', {})).toMatchObject({ ok: false, status: 0 });
  });

  it('screenOf maps the six paths; unknown paths show the password form', () => {
    expect(['/login', '/login/2fa', '/invite', '/forgot-password', '/login/done', '/login/passkey', '/login/zzz'].map(screenOf))
      .toEqual(['login', 'secondStep', 'invite', 'reset', 'done', 'offer', 'login']);
  });
});

describe('source rules', () => {
  const files = [...readdirSync(join(dir, 'screens')).map((f) => `screens/${f}`), 'Shell.tsx', 'PasswordInput.tsx', 'App.tsx'];

  it('no screen hardcodes Romanian text: every string in a component is from the copy file', () => {
    for (const f of files) {
      const src = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(src, f).not.toMatch(/[ăâîșțĂÂÎȘȚ]/);
      expect(src, f).not.toMatch(/(?<![=-])>\s*[A-Za-z][^<>{}=;]{2,}\s*<\//);
    }
  });

  it('every Button opts out of the SaveBar tagger with .pce and no label is Salvează or Publică', () => {
    for (const f of files) {
      for (const m of read(f).matchAll(/<Button\b[^>]*>/g)) expect(m[0], `${f}: ${m[0]}`).toMatch(/className="pce( [\w-]+)?"/);
      expect(read(f), f).not.toMatch(/Salvează\b|Publică/);
    }
    expect(SECURITY_COPY.invite.savePassword).toBe('Salvează parola');
  });

  it('no pills, circles, dashed or dotted shapes, no raw colours', () => {
    for (const f of [...files, 'styles.ts', 'icons.tsx']) {
      const src = read(f);
      for (const bad of ['border-radius: 50%', 'border-radius:50%', '9999px', 'dashed', 'dotted']) expect(src, `${f} ${bad}`).not.toContain(bad);
      expect(src, f).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
  });

  it('imports no Strapi package and not the ui index', () => {
    for (const f of readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((x) => /\.tsx?$/.test(x) && !x.includes('__tests__'))) {
      const src = read(f);
      expect(src, f).not.toMatch(/from '@strapi/);
      expect(src, f).not.toMatch(/from '\.\.?\/(\.\.\/)?admin\/ui'/);
    }
  });

  it('app.tsx no longer injects the Strapi login copy or branding', () => {
    const app = readFileSync(join(dir, '..', 'admin', 'app.tsx'), 'utf8');
    expect(app).not.toContain('AUTH_COPY');
    expect(app).not.toContain('applyLoginBranding');
    expect(app).toContain('startAuthRedirect()');
  });
});
