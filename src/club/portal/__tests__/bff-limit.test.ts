import { describe, expect, it } from 'vitest';
import { PORTAL_HOSTS, clientIp, isBffCall, userAgent } from '../auth/bff';
import { limiter } from '../auth/limit';
import { fakePortalStore } from './fake-portal-store';

const SECRET = 's'.repeat(40);

describe('BFF channel', () => {
  it('accepts only the exact secret', () => {
    expect(isBffCall({ 'x-portal-secret': SECRET }, SECRET)).toBe(true);
    expect(isBffCall({ 'x-portal-secret': [SECRET] }, SECRET)).toBe(true);
    expect(isBffCall({ 'x-portal-secret': 'x'.repeat(40) }, SECRET)).toBe(false);
    expect(isBffCall({ 'x-portal-secret': SECRET.slice(1) }, SECRET)).toBe(false);
    expect(isBffCall({}, SECRET)).toBe(false);
  });
  it('is false when the env secret is unset or shorter than 32', () => {
    expect(isBffCall({ 'x-portal-secret': SECRET }, undefined)).toBe(false);
    expect(isBffCall({ 'x-portal-secret': '' }, '')).toBe(false);
    expect(isBffCall({ 'x-portal-secret': 'short' }, 'short')).toBe(false);
  });
  it('reads client ip and user agent with limits', () => {
    expect(clientIp({ 'x-portal-client-ip': ' 1.2.3.4 ' })).toBe('1.2.3.4');
    expect(clientIp({})).toBe('unknown');
    expect(clientIp({ 'x-portal-client-ip': 'a'.repeat(65) })).toBe('unknown');
    expect(userAgent({})).toBeNull();
    expect(userAgent({ 'x-portal-user-agent': 'u'.repeat(600) })).toHaveLength(512);
  });
  it('reads portal hosts', () => {
    expect(PORTAL_HOSTS({})).toEqual(['antrenor']);
    expect(PORTAL_HOSTS({ PORTAL_HOSTS: 'antrenor, coach' })).toEqual(['antrenor', 'coach']);
  });
});

describe('limiter', () => {
  const make = () => {
    let t = Date.parse('2026-11-06T10:00:00.000Z');
    const { store } = fakePortalStore({ now: () => new Date(t) });
    return { lim: limiter(store, () => new Date(t)), advance: (ms: number) => { t += ms; } };
  };

  it('blocks an ip after 30 attempts', async () => {
    const { lim } = make();
    for (let i = 0; i < 30; i++) expect(await lim.ipBlocked('1.1.1.1')).toBe(false);
    expect(await lim.ipBlocked('1.1.1.1')).toBe(true);
    expect(await lim.ipBlocked('2.2.2.2')).toBe(false);
  });
  it('locks an e-mail with no account at the 5th attempt, firstLock once, for 15 minutes', async () => {
    const { lim, advance } = make();
    const email = 'ghost@example.com';
    const attempts = [];
    for (let i = 0; i < 5; i++) attempts.push(await lim.emailAttempt(email));
    expect(attempts.map((a) => a.refused)).toEqual([false, false, false, false, false]);
    expect(attempts.map((a) => a.locking)).toEqual([false, false, false, false, true]);
    expect(attempts.map((a) => a.firstLock)).toEqual([false, false, false, false, true]);
    expect(await lim.emailAttempt(email)).toEqual({ refused: true, locking: false, firstLock: false });
    advance(14 * 60_000);
    expect((await lim.emailAttempt(email)).refused).toBe(true);
    advance(2 * 60_000);
    expect((await lim.emailAttempt(email)).refused).toBe(false);
  });
  it('a refused attempt does not count', async () => {
    const { lim, advance } = make();
    for (let i = 0; i < 5; i++) await lim.emailAttempt('a@b.ro');
    for (let i = 0; i < 10; i++) await lim.emailAttempt('a@b.ro');
    advance(15 * 60_000 + 1);
    expect((await lim.emailAttempt('a@b.ro')).refused).toBe(false);
  });
  it('emailCleared resets', async () => {
    const { lim } = make();
    for (let i = 0; i < 5; i++) await lim.emailAttempt('a@b.ro');
    expect((await lim.emailAttempt('a@b.ro')).refused).toBe(true);
    await lim.emailCleared('a@b.ro');
    expect((await lim.emailAttempt('a@b.ro')).refused).toBe(false);
  });
  it('allows 5 mails per hour, then again after', async () => {
    const { lim, advance } = make();
    for (let i = 0; i < 5; i++) expect(await lim.mailAllowed('a@b.ro')).toBe(true);
    expect(await lim.mailAllowed('a@b.ro')).toBe(false);
    advance(3_600_001);
    expect(await lim.mailAllowed('a@b.ro')).toBe(true);
  });
});
