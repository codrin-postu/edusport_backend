import type { Core } from '@strapi/strapi';
import { captureMessage } from '../../sentry';

/**
 * While `ADMIN_GATE=off` Strapi's own `/admin/login` issues password-only sessions (no 2FA, no lockout), so a production boot in that state
 * is logged and reported, and cannot be forgotten (B3 L5). Only the exact value `off` opens the gate; answers true when it warned.
 */
export function warnGateOff(strapi: Core.Strapi, env: NodeJS.ProcessEnv = process.env, capture: (m: string) => void = captureMessage): boolean {
  if (env.NODE_ENV !== 'production' || env.ADMIN_GATE !== 'off') return false;
  const message = '[security] ADMIN_GATE=off in production: Strapi password-only admin login is open. Switch the gate on after two Super Admins have signed in.';
  strapi.log.warn(message);
  capture(message);
  return true;
}
