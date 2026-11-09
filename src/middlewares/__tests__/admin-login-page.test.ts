import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pageDecision, pageMiddleware } from '../admin-login-page';

const root = join(__dirname, '..', '..', '..');
const source = (p: string): string => readFileSync(join(root, p), 'utf8');

describe('pageDecision', () => {
  it('serves the html for the six pages', () => {
    for (const p of ['/intrare', '/intrare/', '/intrare/invitatie', '/intrare/parola', '/intrare/2fa', '/intrare/cheie', '/intrare/gata']) {
      expect(pageDecision('GET', p), p).toEqual({ kind: 'html' });
    }
    expect(pageDecision('HEAD', '/intrare')).toEqual({ kind: 'html' });
  });

  it('serves hashed bundle files under /intrare/assets', () => {
    expect(pageDecision('GET', '/intrare/assets/index-AbC123.js')).toEqual({ kind: 'asset', name: 'index-AbC123.js' });
  });

  it('answers 404 for traversal, encoded traversal and unknown paths under /intrare', () => {
    for (const p of ['/intrare/../x', '/intrare/assets/../../x', '/intrare/assets/%2e%2e/x', '/intrare/assets/a/b.js', '/intrare/assets/..', '/intrare/other', '/intrare/gata/x', '/intrare/assets/']) {
      expect(pageDecision('GET', p), p).toEqual({ kind: 'notFound' });
    }
  });

  it('never touches /admin, /api, look-alike prefixes or other methods', () => {
    for (const p of ['/admin', '/admin/auth/login', '/admin/intrare', '/api/admin-auth/login', '/intrareX', '/intrare-x/y', '/']) {
      expect(pageDecision('GET', p), p).toEqual({ kind: 'pass' });
    }
    expect(pageDecision('POST', '/intrare')).toEqual({ kind: 'pass' });
    expect(pageDecision('PUT', '/intrare/2fa')).toEqual({ kind: 'pass' });
  });
});

describe('wiring', () => {
  it('config/middlewares.ts lists global::admin-login-page right after the gate', () => {
    const list = [...source('config/middlewares.ts').matchAll(/'((?:global|strapi)::[a-z-]+)'/g)].map((m) => m[1]);
    expect(list[list.indexOf('global::admin-auth-gate') + 1]).toBe('global::admin-login-page');
  });

  it('the middleware sets no-store on the html, no-referrer and noindex', () => {
    const src = source('src/middlewares/admin-login-page.ts');
    for (const s of ["'no-store'", "'Referrer-Policy', 'no-referrer'", "'X-Robots-Tag', 'noindex'"]) expect(src).toContain(s);
  });

  it('package.json builds the bundle after strapi build', () => {
    expect(JSON.parse(source('package.json')).scripts.build).toBe('strapi build && vite build -c vite.admin-login.config.ts');
  });
});

describe('pageMiddleware over a bundle directory', () => {
  const dir = mkdtempSync(join(tmpdir(), 'intrare-'));
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>x</title>');
  writeFileSync(join(dir, 'assets', 'index-1.js'), 'export {}');
  const run = async (method: string, path: string) => {
    const headers: Record<string, string> = {};
    const ctx = { method, path, status: 200, body: null as unknown, type: '', length: 0, set: (k: string, v: string) => void (headers[k] = v) };
    let passed = false;
    await pageMiddleware(dir)(ctx, async () => void (passed = true));
    (ctx.body as { destroy?: () => void } | null)?.destroy?.();
    return { ctx, headers, passed };
  };

  it('html: no-store, no-referrer, noindex, text/html', async () => {
    const { ctx, headers } = await run('GET', '/intrare/2fa');
    expect(ctx.type).toBe('text/html; charset=utf-8');
    expect(headers['Cache-Control']).toBe('no-store');
    expect(headers['Referrer-Policy']).toBe('no-referrer');
    expect(headers['X-Robots-Tag']).toBe('noindex');
  });

  it('a bundle file is javascript and cached; a missing one and a traversal are 404; /admin passes on', async () => {
    expect((await run('GET', '/intrare/assets/index-1.js')).ctx.type).toBe('application/javascript; charset=utf-8');
    expect((await run('GET', '/intrare/assets/missing.js')).ctx.status).toBe(404);
    expect((await run('GET', '/intrare/../x')).ctx.status).toBe(404);
    expect((await run('GET', '/admin/auth/login')).passed).toBe(true);
  });
});
