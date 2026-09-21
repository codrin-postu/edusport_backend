/**
 * Global middleware that reports request-handling errors to Sentry/GlitchTip.
 *
 * Registered in config/middlewares.ts AFTER `strapi::errors` (i.e. deeper in the
 * chain) so it catches the exception thrown by a controller BEFORE the errors
 * middleware turns it into a response, captures it, then re-throws so Strapi's
 * normal error formatting is unchanged. Inert when no SENTRY_DSN is set.
 *
 * Client errors are not reported. A 4xx says the request was wrong, not that
 * the server is: "BadRequestError: Malicious Path" is koa-static refusing a
 * path that tries to escape the upload directory, which is a bot probing for
 * traversal and being correctly turned away. Those arrived as a fresh issue per
 * probe, so they crowded out real faults on the dashboard and grew without
 * bound. Rate limits and validation failures are the same shape: expected
 * outcomes of a bad request, already visible in the access log.
 *
 * Anything without a status, and anything 5xx, is still reported: that is the
 * server failing, which is what this exists to catch.
 */
import { captureException, sentryEnabled } from '../sentry';

/** True for an error the client caused, which we answer but do not report. */
function isClientError(err: unknown): boolean {
  const status = (err as { status?: unknown; statusCode?: unknown })?.status
    ?? (err as { statusCode?: unknown })?.statusCode;
  return typeof status === 'number' && status >= 400 && status < 500;
}

export default () => async (ctx: any, next: () => Promise<void>) => {
  try {
    await next();
  } catch (err) {
    if (sentryEnabled() && !isClientError(err)) captureException(err);
    throw err;
  }
};
