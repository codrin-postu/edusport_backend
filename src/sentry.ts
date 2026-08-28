import * as Sentry from '@sentry/node';

/**
 * Backend error tracking, sent to the self-hosted GlitchTip instance (Sentry-API
 * compatible). Entirely env-driven and INERT when `SENTRY_DSN` is unset, so the
 * server behaves identically until a DSN is configured. Never throws.
 */
let initialized = false;

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
