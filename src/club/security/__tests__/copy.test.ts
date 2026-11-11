import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SECURITY_ACTIONS, SECURITY_COPY, SECURITY_ERRORS, SECURITY_MAIL, SECURITY_TOASTS, securityHistoryText } from '../copy';

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (typeof value === 'function') out.push(String((value as (...a: unknown[]) => unknown)('X', 'Y')));
  else if (value && typeof value === 'object') for (const v of Object.values(value)) strings(v, out);
  return out;
}

describe('copy rules', () => {
  it('no value uses verificare, a dash, a middle dot, a curly quote or Email without the hyphen', () => {
    const all = strings([SECURITY_ERRORS, SECURITY_TOASTS, SECURITY_COPY, SECURITY_MAIL]);
    const lines = Object.values(SECURITY_ACTIONS).flatMap((a) =>
      securityHistoryText(a, { left: 3, name: 'N', by: 'Ana Pop' }) ?? [],
    );
    expect(all.length).toBeGreaterThan(100);
    for (const s of [...all, ...lines]) {
      expect(s, s).not.toMatch(/verificare/i);
      expect(s, s).not.toMatch(/[—–·„”“]/);
      expect(s, s).not.toMatch(/\bEmail\b/);
    }
  });
});

describe('history lines (13)', () => {
  const cases: [keyof typeof SECURITY_ACTIONS, Record<string, unknown>, string][] = [
    ['totpOn', {}, '2FA activat: aplicație.'],
    ['emailOn', {}, '2FA activat: cod pe e-mail.'],
    ['totpOff', {}, '2FA oprit: aplicație.'],
    ['emailOff', {}, '2FA oprit: cod pe e-mail.'],
    ['newCodes', {}, 'Coduri de rezervă noi.'],
    ['backupUsed', { left: 3 }, 'Cod de rezervă folosit, mai sunt 3.'],
    ['passkeyCreated', { name: 'Telefon' }, 'Cheie de acces creată: Telefon.'],
    ['passkeyDeleted', { name: 'Telefon' }, 'Cheie de acces ștearsă: Telefon.'],
    ['reset', { by: 'Ana Pop' }, '2FA resetat de Ana Pop.'],
    ['reset', { by: 'server' }, '2FA resetat de pe server.'],
    ['locked', {}, 'Blocat 15 minute după 5 coduri greșite.'],
    ['passwordLocked', {}, 'Blocat 15 minute după 5 parole greșite.'],
    ['passwordChanged', {}, 'Parolă schimbată.'],
    ['passwordReset', {}, 'Parolă resetată.'],
    ['googleLinked', {}, 'Google conectat.'],
    ['googleUnlinked', {}, 'Legătura cu Google eliminată.'],
  ];
  it.each(cases)('%s', (action, changes, expected) => {
    expect(securityHistoryText(SECURITY_ACTIONS[action], changes)).toBe(expected);
  });

  it('an unknown action has no line', () => {
    expect(securityHistoryText('nope', {})).toBeNull();
  });
});

describe('api-types.ts', () => {
  it('has no import', () => {
    const source = readFileSync(join(__dirname, '../api-types.ts'), 'utf8');
    expect(source).not.toMatch(/^\s*import\b/m);
    expect(source).not.toMatch(/\brequire\(/);
  });
});
