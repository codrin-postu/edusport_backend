import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { AdminDeviceView, PasskeyRow } from '../security/api-types';
import { SECURITY_COPY, SECURITY_ERRORS } from '../security/copy';
import type { Webauthn } from '../../admin/lib/webauthn';
import { createSecurityApi, type Client } from '../../admin/pages/securitate/client';
import { DevicesList } from '../../admin/pages/securitate/DevicesSection';
import { addKey, confirmReauth, googleReauthUrl, isRemembered, keySub, reauthAsk } from '../../admin/pages/securitate/passkeys';
import { PasskeysList, ReauthForm, RenameForm } from '../../admin/pages/securitate/PasskeysSection';

const dir = join(__dirname, '..', '..', 'admin', 'pages', 'securitate');
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const has = (markup: string, text: string): boolean => markup.includes(esc(text));
const render = (el: React.ReactElement): string => renderToStaticMarkup(el);
const noop = () => undefined;

const rows: PasskeyRow[] = [
  { id: 'a', name: 'iPhone', createdAt: '2026-11-01T10:00:00Z', lastUsedAt: '2026-11-05T10:00:00Z', old: false },
  { id: 'b', name: 'Laptop vechi', createdAt: '2026-10-01T10:00:00Z', lastUsedAt: null, old: true },
];

/** A fake client: a route answers `{ data: { data } }`, or throws the refusal `{ response: { data: { error: { message } } } }`. */
function fakeClient(answers: Record<string, unknown>) {
  const calls: Array<{ method: string; url: string; body?: unknown }> = [];
  const answer = (method: string) => async (url: string, body?: unknown) => {
    calls.push({ method, url, body });
    const a = answers[`${method} ${url}`];
    if (a && typeof a === 'object' && 'refuse' in a) throw { response: { data: { error: { message: (a as { refuse: string }).refuse } } } };
    return { data: { data: a } };
  };
  const client: Client = { get: answer('GET'), post: answer('POST'), put: answer('PUT'), del: answer('DELETE') };
  return { client, calls };
}
const wa = (over: Partial<Webauthn> = {}): Webauthn => ({
  supported: true, autofill: async () => true, platformKey: async () => true, register: async () => ({ id: 'new' }), authenticate: async () => ({}), ...over,
});

describe('the key list', () => {
  it('shows a key with its dates and both buttons, an old key with its note and only "Șterge"', () => {
    const m = render(React.createElement(PasskeysList, { rows, busy: false, onRename: noop, onDelete: noop }));
    expect(has(m, 'iPhone')).toBe(true);
    expect(has(m, keySub(rows[0].createdAt, rows[0].lastUsedAt, (iso) => iso))).toBe(false); // dates use the Romanian long form
    expect(m).toContain('Creat');
    expect(has(m, SECURITY_COPY.passkeys.old)).toBe(true);
    expect(m.split(esc(SECURITY_COPY.passkeys.rename)).length - 1).toBe(1);
    expect(m.split(esc(SECURITY_COPY.passkeys.delete)).length - 1).toBe(2);
    expect(m.match(/class="[^"]*\bpce\b/g)?.length).toBe(3);
  });

  it('a key never used says "niciodată"; the rename form has "Nume" at 60 characters and flat buttons', () => {
    expect(keySub('2026-11-01T10:00:00Z', null, (iso) => iso)).toBe('Creată 2026-11-01, folosită niciodată');
    const m = render(React.createElement(RenameForm, { name: 'iPhone', busy: false, onName: noop, onSave: noop, onCancel: noop }));
    expect(has(m, SECURITY_COPY.passkeys.nameField)).toBe(true);
    expect(m).toContain('maxLength="60"');
    expect(m.match(/class="[^"]*\bpce\b/g)?.length).toBe(2);
  });
});

describe('adding a key', () => {
  const routes = {
    'POST /api/admin-auth/me/passkeys/options': { options: { challenge: 'AA' } },
    'POST /api/admin-auth/me/passkeys': { toast: 'Cheie de acces creată.', passkey: rows[0] },
  };

  it('options, the dialog, register; the toast is the server text', async () => {
    const { client, calls } = fakeClient(routes);
    const out = await addKey(createSecurityApi(client), wa());
    expect(out).toEqual({ kind: 'added', toast: 'Cheie de acces creată.' });
    expect(calls[1]).toMatchObject({ method: 'POST', url: '/api/admin-auth/me/passkeys', body: { response: { id: 'new' } } });
  });

  it('a cancelled dialog is the failure text and registers nothing', async () => {
    const { client, calls } = fakeClient(routes);
    const out = await addKey(createSecurityApi(client), wa({ register: async () => { throw new Error('NotAllowedError'); } }));
    expect(out).toEqual({ kind: 'error', message: SECURITY_ERRORS.passkeyFailed });
    expect(calls).toHaveLength(1);
  });

  it('the 10-key refusal is shown as sent', async () => {
    const { client } = fakeClient({ 'POST /api/admin-auth/me/passkeys/options': { refuse: SECURITY_ERRORS.passkeyLimit } });
    expect(await addKey(createSecurityApi(client), wa())).toEqual({ kind: 'error', message: SECURITY_ERRORS.passkeyLimit });
  });

  it('"Confirmă din nou ca să continui." opens the re-confirmation; a right answer then lets the add run again', async () => {
    const { client, calls } = fakeClient({ 'POST /api/admin-auth/me/passkeys/options': { refuse: SECURITY_ERRORS.reauthRequired } });
    const api = createSecurityApi(client);
    expect(await addKey(api, wa())).toEqual({ kind: 'reauth' });
    const ok = fakeClient({ 'POST /api/admin-auth/me/reauth': { ok: true } });
    expect(await confirmReauth(createSecurityApi(ok.client), reauthAsk({ totp: true, emailCode: false }), ' 123456 ')).toEqual({ ok: true });
    expect(ok.calls[0].body).toEqual({ method: 'totp', code: '123456' });
    const pw = fakeClient({ 'POST /api/admin-auth/me/reauth': { ok: true } });
    await confirmReauth(createSecurityApi(pw.client), reauthAsk({ totp: false, emailCode: false }), 'Throwaway-Admin-1');
    expect(pw.calls[0].body).toEqual({ password: 'Throwaway-Admin-1' });
    expect(calls).toHaveLength(1);
  });

  it('a wrong code in the re-confirmation shows the server text', async () => {
    const { client } = fakeClient({ 'POST /api/admin-auth/me/reauth': { refuse: SECURITY_ERRORS.badCode } });
    expect(await confirmReauth(createSecurityApi(client), { kind: 'code', method: 'email' }, '1')).toEqual({ ok: false, message: SECURITY_ERRORS.badCode });
  });

  it('asks for the app code first, then the e-mail code, else the password', () => {
    expect(reauthAsk({ totp: true, emailCode: true })).toEqual({ kind: 'code', method: 'totp' });
    expect(reauthAsk({ totp: false, emailCode: true })).toEqual({ kind: 'code', method: 'email' });
    expect(reauthAsk({ totp: false, emailCode: false })).toEqual({ kind: 'password' });
  });

  it('the Google re-confirmation keeps remembered or not and returns to Securitate', () => {
    expect(googleReauthUrl(true)).toBe('/api/admin-auth/google/start?remember=1&to=securitate');
    expect(googleReauthUrl(false)).toBe('/api/admin-auth/google/start?remember=0&to=securitate');
    expect(isRemembered({ getItem: () => '"a.b.c"' })).toBe(true);
    expect(isRemembered({ getItem: () => null })).toBe(false);
    expect(isRemembered({ getItem: () => { throw new Error('blocked'); } })).toBe(false);
    expect(isRemembered(null)).toBe(false);
  });

  it('the re-confirmation form offers Google only for a linked account', () => {
    const base = { ask: { kind: 'password' } as const, sentTo: null, value: '', busy: false, onValue: noop, onConfirm: noop, onCancel: noop };
    const withGoogle = render(React.createElement(ReauthForm, { ...base, google: true }));
    expect(withGoogle).toContain(`href="${esc(googleReauthUrl(false))}"`);
    expect(has(withGoogle, SECURITY_ERRORS.reauthRequired)).toBe(true);
    expect(render(React.createElement(ReauthForm, { ...base, google: false }))).not.toContain('google');
  });
});

describe('rename, delete and the other Securitate texts', () => {
  it('rename and delete call the key routes', async () => {
    const { client, calls } = fakeClient({ 'PUT /api/admin-auth/me/passkeys/a': { toast: 'Salvat.' }, 'DELETE /api/admin-auth/me/passkeys/a': { toast: 'Cheie de acces ștearsă.' } });
    const api = createSecurityApi(client);
    await api.passkeyRename('a', 'Telefon');
    await api.passkeyDelete('a');
    expect(calls).toEqual([
      { method: 'PUT', url: '/api/admin-auth/me/passkeys/a', body: { name: 'Telefon' } },
      { method: 'DELETE', url: '/api/admin-auth/me/passkeys/a', body: undefined },
    ]);
  });

  it('marks this device with "Acest dispozitiv" and no other', () => {
    const d = (id: string, current: boolean): AdminDeviceView => ({ id, label: `Dispozitiv ${id}`, lastSeenAt: '2026-11-05T10:00:00Z', current, twoFactorUntil: null });
    const m = render(React.createElement(DevicesList, { devices: [d('1', true), d('2', false)], busy: false, onDisconnect: vi.fn() }));
    expect(m.split(esc(SECURITY_COPY.devices.current)).length - 1).toBe(1);
  });

  it('the Google unlink asks first with the ruled text and "Elimină" / "Renunță"', () => {
    const src = readFileSync(join(dir, 'GoogleSection.tsx'), 'utf8');
    expect(SECURITY_COPY.google.confirmUnlink).toBe('Elimini legătura cu Google? Nu o poți reface din pagină.');
    expect(SECURITY_COPY.google.confirmUnlinkYes).toBe('Elimină');
    expect(SECURITY_COPY.twoFactor.cancel).toBe('Renunță');
    expect(src).toContain('C.confirmUnlink');
    expect(src).toMatch(/onClick=\{\(\) => setAsking\(true\)\}/);
  });

  it('the new files use PceButton only (no raw Button) and no inline colours', () => {
    for (const f of ['PasskeysSection.tsx', 'GoogleSection.tsx', 'passkeys.ts']) {
      const src = readFileSync(join(dir, f), 'utf8');
      expect(src, f).not.toMatch(/<Button\b|<button\b|#[0-9a-fA-F]{3,6}\b|dashed|dotted/);
    }
  });

  it('the password fields sit in a form with a submit button (Enter submits); the Google handoff spinner has a label', () => {
    const pw = readFileSync(join(dir, 'PasswordSection.tsx'), 'utf8');
    expect(pw).toMatch(/<form\b[^>]*onSubmit/);
    expect(pw).toMatch(/<PceButton type="submit"/);
    expect(readFileSync(join(dir, '..', '..', '..', 'admin-login', 'screens', 'Done.tsx'), 'utf8')).toMatch(/<Spinner [^>]*label=/);
  });
});
