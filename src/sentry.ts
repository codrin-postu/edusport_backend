import * as Sentry from '@sentry/node';

/**
 * Backend error tracking, sent to the self-hosted GlitchTip instance (Sentry-API
 * compatible). Entirely env-driven and INERT when `SENTRY_DSN` is unset, so the
 * server behaves identically until a DSN is configured. Never throws.
 */
let initialized = false;

/** Requests whose bodies, cookies, credentials headers and query strings carry passwords, codes or secrets (spec 12). */
const AUTH_PATH_PREFIXES = [
  '/api/admin-auth/', '/api/portal/auth/', '/api/portal/me/', '/login', '/invite', '/forgot-password',
  // Strapi's own admin auth: the login redirects carry `registrationToken` and `code` in the query, the token routes carry the refresh cookie.
  '/admin/auth/', '/admin/access-token', '/admin/renew-token', '/admin/logout',
  // Disabled by the gate (404) but a stray request can still carry a password.
  '/admin/login', '/admin/register', '/admin/forgot-password', '/admin/reset-password',
] as const;

type SpanData = Record<string, unknown>;
type ScrubbableEvent = {
  request?: { url?: string; data?: unknown; cookies?: unknown; query_string?: unknown; headers?: Record<string, unknown> };
  transaction?: string;
  contexts?: { trace?: { data?: SpanData } };
  spans?: { data?: SpanData }[];
};

/** Span data keys that hold a URL or a query string (OpenTelemetry old and new names). */
const URL_DATA_KEYS = ['http.target', 'http.url', 'url.full', 'url.path', 'http.route'] as const;
const QUERY_DATA_KEYS = ['url.query', 'http.query'] as const;
const withoutQuery = (v: string): string => v.split('?')[0].split('#')[0];

function scrubSpanData(data: SpanData | undefined): SpanData | undefined {
  if (!data) return data;
  const out: SpanData = { ...data };
  for (const key of QUERY_DATA_KEYS) delete out[key];
  for (const key of URL_DATA_KEYS) if (typeof out[key] === 'string') out[key] = withoutQuery(out[key]);
  return out;
}

/** A transaction is named "GET /path?query" by some integrations: the path decides, the query goes. */
const transactionPath = (name: string | undefined): string => (name ? pathOf(name.replace(/^[A-Z]+\s+/, '')) : '');

function pathOf(url: string | undefined): string {
  if (!url) return '';
  try {
    return new URL(url, 'http://local.invalid').pathname;
  } catch {
    return url.split('?')[0].split('#')[0];
  }
}

/** For a request to an auth route: drops `request.data`, `request.cookies`, the `cookie` and `authorization` headers and the query string. Other events pass unchanged. */
export function scrubAuthEvent<E extends ScrubbableEvent>(event: E): E {
  const request = event.request;
  const path = request ? pathOf(request.url) : '';
  // The router matches paths without regard to case and with a trailing slash, so the match does the same.
  const isAuth = (p: string): boolean => {
    const path = p.toLowerCase();
    return AUTH_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
  };
  const requestAuth = request !== undefined && isAuth(path);
  const transactionAuth = isAuth(transactionPath(event.transaction));
  if (!requestAuth && !transactionAuth) return event;
  const out = { ...event };
  if (request && requestAuth) {
    const headers = request.headers
      ? Object.fromEntries(Object.entries(request.headers).filter(([name]) => !['cookie', 'authorization', 'set-cookie', 'x-portal-secret', 'x-portal-device'].includes(name.toLowerCase())))
      : request.headers;
    const { data: _data, cookies: _cookies, query_string: _query, ...rest } = request;
    out.request = { ...rest, ...(request.url ? { url: withoutQuery(request.url) } : {}), ...(headers ? { headers } : {}) };
  }
  // Transaction events: the name and the span data of the request can carry the query string too.
  if (typeof event.transaction === 'string') out.transaction = withoutQuery(event.transaction);
  if (event.contexts?.trace?.data) out.contexts = { ...event.contexts, trace: { ...event.contexts.trace, data: scrubSpanData(event.contexts.trace.data) } };
  if (event.spans) out.spans = event.spans.map((span) => (span.data ? { ...span, data: scrubSpanData(span.data) } : span));
  return out;
}

export function sentryEnabled(): boolean {
  return Boolean(process.env.SENTRY_DSN);
}

export function initSentry(): void {
  if (initialized || !sentryEnabled()) return;
  try {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
      beforeSend: (event) => scrubAuthEvent(event),
      beforeSendTransaction: (event) => scrubAuthEvent(event),
    });
    initialized = true;
  } catch {
    // Never let observability wiring break the server boot.
  }
}

export function captureException(err: unknown): void {
  if (!initialized) return;
  try {
    Sentry.captureException(err);
  } catch {
    /* ignore */
  }
}

/**
 * Report a message (no exception object) as an error-level event. GlitchTip groups events by
 * message and alerts on a new issue, so callers keep personal data out of `message`.
 */
export function captureMessage(message: string): void {
  if (!initialized) return;
  try {
    Sentry.captureMessage(message, 'error');
  } catch {
    /* ignore */
  }
}
