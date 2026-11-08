import { describe, expect, it } from 'vitest';
import { securityHistoryText } from '../copy';
import { confirmTotp, startTotp } from '../factors';
import { resetTwoFactor } from '../reset';
import { open, totpAad } from '../secret-box';
import { totpAt } from '../totp';
import { TEST_KEYS } from './keys';
import { ADMIN_SUBJECT, EMAIL, PORTAL_SUBJECT as S, setup } from './security-helpers';

async function enrolled(env: ReturnType<typeof setup>, s = S) {
  await startTotp(env.c, s, EMAIL);
  const row = (await env.mem.store.factors(s))[0];
  const secret = open(TEST_KEYS, row.secretBox!, totpAad(s.type, s.id))!.plain;
  await confirmTotp(env.c, s, totpAt(secret, Math.floor(env.clock.t.getTime() / 30_000)));
  await env.mem.store.createPasskey({ subject: s, credentialId: `c-${s.id}`, publicKey: 'k', counter: 0, transports: [], deviceType: 'singleDevice', backedUp: false, rpId: 'x.ro', name: 'Tel', createdAt: env.clock.t.toISOString() });
  env.mem.history.length = 0;
  env.mails.length = 0;
}

describe('resetTwoFactor', () => {
  it('clears factors and codes, keeps passkeys, forgets devices, ends sessions, writes history and mails', async () => {
    const env = setup();
    await enrolled(env);
    await resetTwoFactor(env.c, S, EMAIL, 'Ana Pop');
    expect(await env.mem.store.factors(S)).toEqual([]);
    expect(await env.mem.store.unusedBackup(S)).toEqual([]);
    expect(await env.mem.store.passkeys(S)).toHaveLength(1);
    expect(env.forget).toHaveBeenCalledWith(S, {});
    expect(env.endSessions).toHaveBeenCalledWith(S, {});
    expect(env.mem.history.map((h) => securityHistoryText(h.action, h.changes))).toEqual(['2FA resetat de Ana Pop.']);
    expect(env.mails).toEqual([{ to: EMAIL, kind: 'reset2fa', data: {} }]);
  });

  it("'server' writes the server line", async () => {
    const env = setup();
    await enrolled(env, ADMIN_SUBJECT);
    await resetTwoFactor(env.c, ADMIN_SUBJECT, EMAIL, 'server');
    expect(env.mem.history.map((h) => securityHistoryText(h.action, h.changes))).toEqual(['2FA resetat de pe server.']);
    expect(env.mem.history[0].actor).toBe('Ana Pop');
  });

  it('works without keys and a failing mail does not fail the reset', async () => {
    const env = setup({ mailOk: false });
    await enrolled(env);
    const keyless = { ...env.c, keys: null, mail: async () => { throw new Error('down'); } };
    await resetTwoFactor(keyless, S, EMAIL, 'Ana Pop');
    expect(await env.mem.store.factors(S)).toEqual([]);
    expect(env.logs.some((l) => l.includes('mail reset2fa failed'))).toBe(true);
  });
});
