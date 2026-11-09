import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';

export type PageDecision = { kind: 'html' } | { kind: 'asset'; name: string } | { kind: 'notFound' } | { kind: 'pass' };

/** The five pages of the sign-in bundle (spec 4.1) and `/login/done` (ruling 18); every one is the same single-page html. */
const PAGES = new Set(['/login', '/invite', '/forgot-password', '/login/2fa', '/login/passkey', '/login/done']);
const ASSET = /^\/login\/assets\/([A-Za-z0-9_][A-Za-z0-9_.-]*)$/;

/** Everything under `/login`, and the two pages outside it (`/invite`, `/forgot-password`, which may carry a trailing slash). */
const isBundlePath = (pathname: string): boolean =>
  pathname === '/login' || pathname.startsWith('/login/') || /^\/(invite|forgot-password)\/?$/.test(pathname);

/**
 * Pure: what the page middleware does with a request. Only `GET` and `HEAD` under `/login` are its business; everything else
 * (the whole `/admin` and `/api` tree included) passes untouched. A path under `/login` that is neither a page nor a bundle file
 * (a `..` segment, an encoded one, an unknown name) is a 404, never a file read.
 */
export function pageDecision(method: string, pathname: string): PageDecision {
  if (!isBundlePath(pathname)) return { kind: 'pass' };
  if (method !== 'GET' && method !== 'HEAD') return { kind: 'pass' };
  const trimmed = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  if (PAGES.has(trimmed)) return { kind: 'html' };
  const asset = ASSET.exec(pathname);
  return asset && !asset[1].includes('..') ? { kind: 'asset', name: asset[1] } : { kind: 'notFound' };
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

type PageCtx = {
  method: string; path: string; status: number; body: unknown; type: string;
  set: (name: string, value: string) => void; length?: number;
};

const bundleDir = (): string => path.join(process.cwd(), 'dist', 'admin-login');

/** Headers for every answer of the page: no referrer, no indexing; the html is never cached, the hashed files are for a year. */
function headers(ctx: PageCtx, html: boolean): void {
  ctx.set('Referrer-Policy', 'no-referrer');
  ctx.set('X-Robots-Tag', 'noindex');
  ctx.set('Cache-Control', html ? 'no-store' : 'public, max-age=31536000, immutable');
}

function send(ctx: PageCtx, file: string, html: boolean): void {
  if (!existsSync(file)) {
    ctx.status = 404;
    ctx.body = 'Not Found';
    return;
  }
  headers(ctx, html);
  ctx.type = TYPES[path.extname(file)] ?? 'application/octet-stream';
  ctx.length = statSync(file).size;
  ctx.body = ctx.method === 'HEAD' ? null : createReadStream(file);
}

/** The middleware over a bundle directory (a test passes a temporary one). */
export const pageMiddleware = (dir: string) => async (ctx: PageCtx, next: () => Promise<void>): Promise<void> => {
  const decision = pageDecision(ctx.method, ctx.path);
  if (decision.kind === 'pass') return next();
  if (decision.kind === 'notFound') {
    ctx.status = 404;
    ctx.body = 'Not Found';
    return;
  }
  if (decision.kind === 'html') return send(ctx, path.join(dir, 'index.html'), true);
  return send(ctx, path.join(dir, 'assets', decision.name), false);
};

/** Global middleware serving the `/login` bundle from `dist/admin-login` (built by `vite build -c vite.admin-login.config.ts`). */
export default (_config?: unknown, _deps?: unknown) => pageMiddleware(bundleDir());
