/**
 * Global middleware that reports request-handling errors to Sentry/GlitchTip.
 *
 * Registered in config/middlewares.ts AFTER `strapi::errors` (i.e. deeper in the
 * chain) so it catches the exception thrown by a controller BEFORE the errors
 * middleware turns it into a response, captures it, then re-throws so Strapi's
 * normal error formatting is unchanged. Inert when no SENTRY_DSN is set.
 */
import { captureException, sentryEnabled } from '../sentry';

export default () => async (ctx: any, next: () => Promise<void>) => {
  try {
    await next();
  } catch (err) {
    if (sentryEnabled()) captureException(err);
    throw err;
  }
};
