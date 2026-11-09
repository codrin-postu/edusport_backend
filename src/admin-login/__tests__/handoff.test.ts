import { describe, expect, it, vi } from 'vitest';
import { finishGoogle, openAfterLogin, storeHandoff, storeToken, takeGateToken, type HandoffWindow } from '../handoff';

/** A stand-in for `window`: a cookie jar that keeps what was set (a past `Expires` removes), local storage, and `location.assign`. */
function fakeWindow(protocol = 'http:', cookies: Record<string, string> = {}) {
  const jar = new Map(Object.entries(cookies));
  const writes: string[] = [];
  const storage = new Map<string, string>();
  const assigned: string[] = [];
  const w: HandoffWindow = {
    localStorage: { setItem: (k, v) => void storage.set(k, v), removeItem: (k) => void storage.delete(k) },
    document: {
      get cookie() {
        return [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
      },
      set cookie(raw: string) {
        writes.push(raw);
        const [pair, ...attrs] = raw.split(';').map((p) => p.trim());
        const eq = pair.indexOf('=');
        const [name, value] = [pair.slice(0, eq), pair.slice(eq + 1)];
        const gone = attrs.some((a) => a.startsWith('Expires=Thu, 01 Jan 1970'));
        if (gone) jar.delete(name);
        else jar.set(name, value);
      },
    },
    location: { protocol, assign: (url) => void assigned.push(url) },
  };
  return { w, jar, writes, storage, assigned };
}

describe('storeHandoff', () => {
  it('remember: localStorage jwtToken (JSON) and isLoggedIn, no cookie, then /admin', () => {
    const f = fakeWindow();
    storeHandoff({ accessToken: 'tok.en.1', remember: true, offerPasskey: false }, f.w);
    expect(f.storage.get('jwtToken')).toBe(JSON.stringify('tok.en.1'));
    expect(f.storage.get('isLoggedIn')).toBe('true');
    expect(f.jar.has('jwtToken')).toBe(false);
    expect(f.assigned).toEqual(['/admin']);
  });

  it('not remember: the jwtToken cookie on /admin as the SPA sets it, isLoggedIn, nothing in localStorage', () => {
    const f = fakeWindow();
    storeHandoff({ accessToken: 'tok.en.2', remember: false, offerPasskey: false }, f.w);
    expect(f.jar.get('jwtToken')).toBe('tok.en.2');
    expect(f.writes.at(-1)).toBe('jwtToken=tok.en.2; Path=/admin');
    expect(f.storage.has('jwtToken')).toBe(false);
    expect(f.storage.get('isLoggedIn')).toBe('true');
    expect(f.assigned).toEqual(['/admin']);
  });

  it('not remember over https: the cookie is Secure', () => {
    const f = fakeWindow('https:');
    storeToken('t', false, f.w);
    expect(f.writes.at(-1)).toBe('jwtToken=t; Path=/admin; Secure');
  });

  it('a token left in localStorage by an earlier remembered login does not shadow a session-only one', () => {
    const f = fakeWindow();
    f.storage.set('jwtToken', JSON.stringify('old'));
    storeToken('new', false, f.w);
    expect(f.storage.has('jwtToken')).toBe(false);
  });
});

describe('Google handoff page', () => {
  it('takeGateToken reads the readable jwtToken cookie and deletes it at once', () => {
    const f = fakeWindow('http:', { jwtToken: 'google.tok', other: 'x' });
    expect(takeGateToken(f.w)).toBe('google.tok');
    expect(f.jar.has('jwtToken')).toBe(false);
    expect(f.jar.get('other')).toBe('x');
    expect(f.writes[0]).toBe('jwtToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT');
  });

  it('no cookie: null, nothing stored, no navigation', () => {
    const f = fakeWindow();
    expect(takeGateToken(f.w)).toBeNull();
    expect(finishGoogle(true, f.w)).toBe(false);
    expect(f.storage.size).toBe(0);
    expect(f.assigned).toEqual([]);
  });

  it('remember=1 moves the cookie token to localStorage and opens /admin', () => {
    const f = fakeWindow('http:', { jwtToken: 'g1' });
    expect(finishGoogle(true, f.w)).toBe(true);
    expect(f.storage.get('jwtToken')).toBe(JSON.stringify('g1'));
    expect(f.jar.has('jwtToken')).toBe(false);
    expect(f.assigned).toEqual(['/admin']);
  });

  it('remember=0 keeps it as the SPA cookie on /admin (the server copy on / is gone)', () => {
    const f = fakeWindow('http:', { jwtToken: 'g2' });
    expect(finishGoogle(false, f.w)).toBe(true);
    expect(f.writes.some((x) => x === 'jwtToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT')).toBe(true);
    expect(f.writes.at(-1)).toBe('jwtToken=g2; Path=/admin');
    expect(f.storage.has('jwtToken')).toBe(false);
  });
});

describe('finishGoogle target', () => {
  it('opens Securitate only for the allow-listed name `securitate`, else /admin', () => {
    for (const [to, expected] of [['securitate', '/admin/plugins/edusport-securitate'], ['https://evil.example', '/admin'], ['__proto__', '/admin'], [null, '/admin']] as const) {
      const f = fakeWindow('http:', { jwtToken: 'a.b.c' });
      expect(finishGoogle(true, f.w, to)).toBe(true);
      expect(f.assigned, String(to)).toEqual([expected]);
    }
  });
});

describe('openAfterLogin (the offer decision)', () => {
  const h = (offerPasskey: boolean) => ({ accessToken: 'a.b.c', remember: true, offerPasskey });

  it('no offer: stores the session and opens /admin without asking the device', async () => {
    const f = fakeWindow();
    const go = vi.fn();
    const platformKey = vi.fn(async () => true);
    await openAfterLogin(h(false), platformKey, f.w, go);
    expect(f.assigned).toEqual(['/admin']);
    expect(f.storage.get('jwtToken')).toBe('"a.b.c"');
    expect(platformKey).not.toHaveBeenCalled();
    expect(go).not.toHaveBeenCalled();
  });

  it('offer on a device with a built-in key: token stored first, then /login/passkey with the token, no /admin yet', async () => {
    const f = fakeWindow();
    const go = vi.fn();
    await openAfterLogin(h(true), async () => true, f.w, go);
    expect(f.storage.get('jwtToken')).toBe('"a.b.c"');
    expect(f.storage.get('isLoggedIn')).toBe('true');
    expect(go).toHaveBeenCalledWith('/login/passkey', { token: 'a.b.c' });
    expect(f.assigned).toEqual([]);
  });

  it('offer on a device without a built-in key (or when the check fails): straight to /admin, no offer', async () => {
    for (const platformKey of [async () => false, async () => { throw new Error('x'); }]) {
      const f = fakeWindow();
      const go = vi.fn();
      await openAfterLogin(h(true), platformKey, f.w, go);
      expect(f.assigned).toEqual(['/admin']);
      expect(go).not.toHaveBeenCalled();
    }
  });
});
