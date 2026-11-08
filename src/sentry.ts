import * as Sentry from '@sentry/node';

/**
 * Backend error tracking, sent to the self-hosted GlitchTip instance (Sentry-API
 * compatible). Entirely env-driven and INERT when `SENTRY_DSN` is unset, so the
 * server behaves identically until a DSN is configured. Never throws.
 */
let initialized = false;

/** Requests whose bodies, cookies, credentials headers and query strings carry passwords, codes or secrets (spec 12). */
const AUTH_PATH_PREFIXES = ['/api/admin-auth/', '/api/portal/auth/', '/api/portal/me/', '/intrare'] as const;

type ScrubbableEvent = {
  request?: { url?: string; data?: unknown; cookies?: unknown; query_string?: unknown; headers?: Record<string, unknown> };
};

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
  if (!request) return event;
  const path = pathOf(request.url);
  if (!AUTH_PATH_PREFIXES.some((p) => path.startsWith(p))) return event;
  const headers = request.headers
    ? Object.fromEntries(Object.entries(request.headers).filter(([name]) => !['cookie', 'authorization', 'set-cookie'].includes(name.toLowerCase())))
    : request.headers;
  const { data: _data, cookies: _cookies, query_string: _query, ...rest } = request;
  return { ...event, request: { ...rest, ...(request.url ? { url: request.url.split('?')[0].split('#')[0] } : {}), ...(headers ? { headers } : {}) } };
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
