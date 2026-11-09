import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { AdminDeviceView, SecurityView } from '../security/api-types';
import { SECURITY_COPY } from '../security/copy';
import { AdminsList } from '../../admin/pages/securitate/AdminsSection';
import { BackupCodesBody } from '../../admin/pages/securitate/BackupCodesWindow';
import { createSecurityApi, type Client } from '../../admin/pages/securitate/client';
import { DevicesList } from '../../admin/pages/securitate/DevicesSection';
import {
  afterDisconnect, afterPassword, apply, askOff, codesFile, confirmTotp, INITIAL, newBatch, offTitle, reduce, startTotp, turnOff,
} from '../../admin/pages/securitate/state';
import { EmailSetup, TotpSetup, TwoFactorRows } from '../../admin/pages/securitate/TwoFactorSection';

const admin = join(__dirname, '..', '..', 'admin');
const dir = join(admin, 'pages', 'securitate');
const src = (p: string): string => readFileSync(join(admin, p), 'utf8');
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const has = (markup: string, text: string): boolean => markup.includes(esc(text));
const render = (el: React.ReactElement): string => renderToStaticMarkup(el);

const view = (over: Partial<SecurityView> = {}): SecurityView => ({
  email: 'admin1@example.invalid', totp: false, emailCode: false, backupLeft: 0, backupNotice: null, passkeys: [], passkeyLimit: 10, ...over,
});

/** A fake fetch client: each route answers `{ data: { data } }` like the admin client, and every call is recorded. */
function fakeClient(answers: Record<string, unknown>) {
  const calls: Array<{ method: string; url: string; body?: unknown }> = [];
  const answer = (method: string) => async (url: string, body?: unknown) => {
    calls.push({ method, url, body });
    return { data: { data: answers[`${method} ${url}`] } };
  };
  const client: Client = { get: answer('GET'), post: answer('POST'), put: answer('PUT'), del: answer('DELETE') };
  return { client, calls };
}

const CODES = ['AAAAA BBBBB', 'CCCCC DDDDD'];
const noop = () => undefined;
const setupProps = { code: '', busy: false, onCode: noop, onConfirm: noop, onCancel: noop };

describe('the app enrolment flow', () => {
  const routes = {
    'POST /api/admin-auth/me/2fa/totp': { qrSvg: '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>', key: 'ABCD EFGH IJKL' },
    'POST /api/admin-auth/me/2fa/totp/confirm': { toast: '2FA activat.', backupCodes: CODES },
    'GET /api/admin-auth/me/security': view({ totp: true, backupLeft: 10 }),
  };

  it('start shows the QR image and the key, confirm shows the backup codes, "Gata" clears them from the state', async () => {
    const { client, calls } = fakeClient(routes);
    const api = createSecurityApi(client);
    let state = apply(INITIAL, await startTotp(api));
    expect(state.panel).toMatchObject({ kind: 'totp', key: 'ABCD EFGH IJKL' });
    if (state.panel.kind !== 'totp') throw new Error('no panel');
    const shown = render(React.createElement(TotpSetup, { ...setupProps, qrSvg: state.panel.qrSvg, keyText: state.panel.key }));
    expect(shown).toContain('data:image/svg+xml;utf8,');
    expect(shown).toContain(encodeURIComponent(state.panel.qrSvg));
    expect(has(shown, SECURITY_COPY.twoFactor.appScan)).toBe(true);
    expect(has(shown, SECURITY_COPY.twoFactor.appKey('ABCD EFGH IJKL'))).toBe(true);
    expect(has(shown, SECURITY_COPY.twoFactor.appCode)).toBe(true);

    state = apply(state, await confirmTotp(api, ' 123456 '));
    expect(calls.find((c) => c.url.endsWith('/totp/confirm'))?.body).toEqual({ code: '123456' });
    expect(state.codes).toEqual(CODES);
    expect(state.panel).toEqual({ kind: 'idle' });
    expect(state.toast).toBe('2FA activat.');
    const window = render(React.createElement(BackupCodesBody, { codes: state.codes ?? [], onDownload: noop, onCopy: noop, onDone: noop }));
    for (const t of [...CODES, SECURITY_COPY.backup.note, SECURITY_COPY.backup.download, SECURITY_COPY.backup.copy, SECURITY_COPY.backup.done]) expect(has(window, t), t).toBe(true);

    state = reduce(state, { type: 'codesDone' });
    expect(state.codes).toBeNull();
    expect(JSON.stringify(state)).not.toContain('AAAAA');
  });

  it('the window code file is one code per line, named as ruling 12 says', () => {
    expect(codesFile(CODES)).toBe('AAAAA BBBBB\nCCCCC DDDDD\n');
    expect(src('pages/securitate/state.ts')).toContain("'edusport-coduri-de-rezerva.txt'");
  });

  it('e-mail setup names the address the code went to', () => {
    const shown = render(React.createElement(EmailSetup, { ...setupProps, sentTo: 'admin1@example.invalid' }));
    expect(has(shown, SECURITY_COPY.twoFactor.emailSent('admin1@example.invalid'))).toBe(true);
    expect(has(shown, SECURITY_COPY.twoFactor.emailCode)).toBe(true);
  });
});

describe('turning off and new codes', () => {
  it('the last method asks "Oprești 2FA? Codurile de rezervă vor fi șterse."', () => {
    const panel = askOff(view({ totp: true, backupLeft: 10 }), 'totp');
    expect(panel).toEqual({ kind: 'off', method: 'totp', last: true });
    expect(offTitle('totp', true)).toBe('Oprești 2FA? Codurile de rezervă vor fi șterse.');
  });

  it('with two methods on, turning one off names the method', () => {
    const panel = askOff(view({ totp: true, emailCode: true, backupLeft: 10 }), 'email');
    expect(panel).toEqual({ kind: 'off', method: 'email', last: false });
    expect(offTitle('email', false)).toBe('Oprești Cod pe e-mail?');
  });

  it('"Generează coduri noi" asks "Codurile vechi nu vor mai merge." and the confirmation is wired to it', () => {
    expect(SECURITY_COPY.backup.generateConfirm).toBe('Codurile vechi nu vor mai merge.');
    expect(src('pages/securitate/TwoFactorSection.tsx')).toContain('message={B.generateConfirm}');
  });

  it('a new batch shows its codes; turning a method off reads the view again, with the toast and no codes', async () => {
    const { client, calls } = fakeClient({
      'POST /api/admin-auth/me/backup-codes': { toast: 'Coduri noi generate.', backupCodes: CODES },
      'DELETE /api/admin-auth/me/2fa/email': { toast: '2FA oprit.' },
      'GET /api/admin-auth/me/security': view({ totp: true, backupLeft: 10 }),
    });
    const api = createSecurityApi(client);
    expect(apply(INITIAL, await newBatch(api)).codes).toEqual(CODES);
    const off = apply(INITIAL, await turnOff(api, 'email'));
    expect(off.codes).toBeNull();
    expect(off.toast).toBe('2FA oprit.');
    expect(calls.some((c) => c.method === 'DELETE' && c.url === '/api/admin-auth/me/2fa/email')).toBe(true);
  });

  it('"Mai ai <n> coduri de rezervă." comes from the first read only', () => {
    let s = reduce(INITIAL, { type: 'view', view: view({ totp: true, backupLeft: 7, backupNotice: 7 }), first: true });
    expect(s.notice).toBe(7);
    s = reduce(s, { type: 'view', view: view({ totp: true, backupLeft: 7, backupNotice: null }) });
    expect(s.notice).toBe(7);
    expect(SECURITY_COPY.backup.backupLeft(7)).toBe('Mai ai 7 coduri de rezervă.');
  });
});

describe('rows', () => {
  it('shows Activ / Oprit with Activează / Oprește, and the backup row once a method is on', () => {
    const on = render(React.createElement(TwoFactorRows, { view: view({ totp: true, backupLeft: 10 }), busy: false, onEnable: noop, onDisable: noop, onRegenerate: noop }));
    const C = SECURITY_COPY.twoFactor;
    for (const t of [C.app, C.email, C.active, C.off, C.enable, C.disable, SECURITY_COPY.backup.title, '10 rămase', SECURITY_COPY.backup.generate]) expect(has(on, t), t).toBe(true);
    const none = render(React.createElement(TwoFactorRows, { view: view(), busy: false, onEnable: noop, onDisable: noop, onRegenerate: noop }));
    expect(has(none, SECURITY_COPY.backup.title)).toBe(false);
  });
});

describe('password', () => {
  it('sends { current, password }, shows "Parolă schimbată." and goes to /login only when the session ended', async () => {
    const { client, calls } = fakeClient({ 'POST /api/admin-auth/me/password': { toast: 'Parolă schimbată.', signedOut: false } });
    const done = await createSecurityApi(client).changePassword({ current: 'Old-Password-1', password: 'New-Password-2' });
    expect(calls[0]).toEqual({ method: 'POST', url: '/api/admin-auth/me/password', body: { current: 'Old-Password-1', password: 'New-Password-2' } });
    expect(afterPassword(done)).toEqual({ toast: 'Parolă schimbată.', goTo: null });
    expect(afterPassword({ toast: 'Parolă schimbată.', signedOut: true })).toEqual({ toast: 'Parolă schimbată.', goTo: '/login' });
  });
});

describe('devices and Administratori', () => {
  const device: AdminDeviceView = { id: 'd1', label: 'Chrome pe Mac', lastSeenAt: '2026-11-08T10:00:00.000Z', current: true, twoFactorUntil: '2026-12-06T10:00:00.000Z' };

  it('lists the device, the last time and the remembered-2FA line, and disconnecting this browser leaves for /login', () => {
    const shown = render(React.createElement(DevicesList, { devices: [device, { ...device, id: 'd2', twoFactorUntil: null }], busy: false, onDisconnect: noop }));
    for (const t of ['Chrome pe Mac', SECURITY_COPY.devices.device, SECURITY_COPY.devices.lastSeen, SECURITY_COPY.devices.disconnect, SECURITY_COPY.devices.rememberedUntil('6 dec 2026')]) expect(has(shown, t), t).toBe(true);
    expect(shown.match(/ținut minte/g)).toHaveLength(1);
    expect(afterDisconnect({ revokedCurrent: true })).toBe('/login');
    expect(afterDisconnect({ revokedCurrent: false })).toBeNull();
  });

  it('Administratori has no reset button on the own row, and shows 2FA activ / oprit', () => {
    const rows = [
      { id: 1, name: 'Ana Pop', email: 'ana@example.invalid', twoFactor: true, self: true },
      { id: 2, name: 'Ion Rus', email: 'ion@example.invalid', twoFactor: false, self: false },
    ];
    const shown = render(React.createElement(AdminsList, { rows, busy: false, onReset: noop }));
    expect(shown.match(new RegExp(esc(SECURITY_COPY.admins.reset), 'g'))).toHaveLength(1);
    expect(shown.indexOf(esc(SECURITY_COPY.admins.reset))).toBeGreaterThan(shown.indexOf('Ion Rus'));
    for (const t of [SECURITY_COPY.admins.on, SECURITY_COPY.admins.off, 'ana@example.invalid']) expect(has(shown, t), t).toBe(true);
  });

  it('the page renders the Administratori section for a Super Admin only', () => {
    expect(src('pages/SecuritatePage.tsx')).toContain('{superAdmin && <AdminsSection api={api} />}');
  });
});

describe('page rules', () => {
  const sources = [...readdirSync(dir).filter((f) => /\.tsx?$/.test(f)).map((f) => `pages/securitate/${f}`), 'pages/SecuritatePage.tsx'];

  it('every button carries the pce class: rendered buttons and source', () => {
    const rendered = [
      render(React.createElement(TwoFactorRows, { view: view({ totp: true, backupLeft: 3 }), busy: false, onEnable: noop, onDisable: noop, onRegenerate: noop })),
      render(React.createElement(TotpSetup, { ...setupProps, qrSvg: '<svg/>', keyText: 'K' })),
      render(React.createElement(EmailSetup, { ...setupProps, sentTo: 'a@example.invalid' })),
      render(React.createElement(BackupCodesBody, { codes: CODES, onDownload: noop, onCopy: noop, onDone: noop })),
      render(React.createElement(AdminsList, { rows: [{ id: 2, name: 'Ion', email: 'i@example.invalid', twoFactor: true, self: false }], busy: false, onReset: noop })),
      render(React.createElement(DevicesList, { devices: [{ id: 'd', label: 'x', lastSeenAt: '2026-11-08T10:00:00.000Z', current: false, twoFactorUntil: null }], busy: false, onDisconnect: noop })),
    ].join('');
    const buttons = rendered.match(/<button\b[^>]*>/g) ?? [];
    expect(buttons.length).toBeGreaterThan(10);
    for (const b of buttons) expect(b, b).toMatch(/class="[^"]*\bpce\b/);
    for (const f of sources) {
      const code = src(f);
      if (!f.endsWith('PceButton.tsx')) {
        expect(code, f).not.toMatch(/<Button\b/);
        expect(code, f).not.toMatch(/<button\b/);
      }
    }
  });

  it('no label is "Salvează" or "Publică"', () => {
    for (const label of [SECURITY_COPY.password.change, SECURITY_COPY.twoFactor.enable, SECURITY_COPY.twoFactor.confirmOff, SECURITY_COPY.backup.generate, SECURITY_COPY.admins.reset, SECURITY_COPY.google.unlink]) {
      expect(label).not.toMatch(/Salvează|Publică/i);
    }
    for (const f of sources) expect(src(f), f).not.toMatch(/Salvează|Publică/);
  });

  it('no visible text contains "verificare"', () => {
    for (const f of sources) expect(src(f).toLowerCase(), f).not.toContain('verificare');
    const all = JSON.stringify([SECURITY_COPY.twoFactor, SECURITY_COPY.backup, SECURITY_COPY.password, SECURITY_COPY.google, SECURITY_COPY.devices, SECURITY_COPY.admins, SECURITY_COPY.page]);
    expect(all.toLowerCase()).not.toContain('verificare');
  });

  it('no component hardcodes Romanian text; no pills, circles, dashed or dotted lines, no raw colours', () => {
    for (const f of sources) {
      const code = src(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*(\/\/|\{\/\*).*$/gm, '');
      expect(code, f).not.toMatch(/[ăâîșțĂÂÎȘȚ]/);
      expect(code, f).not.toMatch(/(?<![=-])>\s*[A-Za-z][^<>{}=;]{2,}\s*<\//);
      for (const bad of ['border-radius: 50%', '9999px', "'50%'", 'dashed', 'dotted']) expect(code, `${f} ${bad}`).not.toContain(bad);
      expect(code, f).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(code, f).not.toMatch(/color:\s*'?(red|crimson)/);
    }
  });

  it('only the API hook and the page import the Strapi package', () => {
    for (const f of sources) {
      const strapi = /from '@strapi\//.test(src(f));
      expect(strapi, f).toBe(f.endsWith('securitate/api.tsx'));
    }
  });
});

describe('menu', () => {
  it('Securitate sits in the system group on /plugins/edusport-securitate', () => {
    expect(src('pages/routes.ts')).toContain("SECURITATE_TO = '/plugins/edusport-securitate'");
    const menu = src('dashboard/menu.tsx');
    expect(menu).toContain("{ to: SECURITATE_TO, label: SECURITY_COPY.page.title, icon: Lock, group: 'system' }");
    expect(menu).toContain("Component: () => import('../pages/SecuritatePage')");
    expect(SECURITY_COPY.page.title).toBe('Securitate');
  });
});
