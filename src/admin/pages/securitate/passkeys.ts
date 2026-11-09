import type { SecurityView } from '../../../club/security/api-types';
import { SECURITY_COPY, SECURITY_ERRORS } from '../../../club/security/copy';
import type { Webauthn } from '../../lib/webauthn';
import type { SecurityApi } from './client';
import { errorText } from './errors';

/** What the re-confirmation asks for: the 2FA code when the account has an app or e-mail code, else the password. */
export type ReauthAsk = { kind: 'password' } | { kind: 'code'; method: 'totp' | 'email' };

export function reauthAsk(view: Pick<SecurityView, 'totp' | 'emailCode'>): ReauthAsk {
  if (view.totp) return { kind: 'code', method: 'totp' };
  if (view.emailCode) return { kind: 'code', method: 'email' };
  return { kind: 'password' };
}

export type AddOutcome = { kind: 'added'; toast: string } | { kind: 'reauth' } | { kind: 'error'; message: string };

/**
 * "Creează o cheie de acces": options, the browser's dialog, register. A server answer of "Confirmă din nou ca să continui." (403) is not an
 * error to show but the step to open (re-confirm, then run this again). A cancelled dialog is the one failure text.
 */
export async function addKey(api: SecurityApi, wa: Webauthn): Promise<AddOutcome> {
  let options: { options: unknown };
  try {
    options = await api.passkeyOptions();
  } catch (e) {
    const message = errorText(e);
    return message === SECURITY_ERRORS.reauthRequired ? { kind: 'reauth' } : { kind: 'error', message };
  }
  let response: unknown;
  try {
    response = await wa.register(options.options);
  } catch {
    return { kind: 'error', message: SECURITY_ERRORS.passkeyFailed };
  }
  try {
    const added = await api.passkeyAdd(response);
    return { kind: 'added', toast: added.toast };
  } catch (e) {
    const message = errorText(e);
    return message === SECURITY_ERRORS.reauthRequired ? { kind: 'reauth' } : { kind: 'error', message };
  }
}

/** Sends the e-mail code a re-confirmation by e-mail needs; the address is the one the server wrote to. */
export async function startEmailReauth(api: SecurityApi): Promise<{ ok: true; sentTo: string } | { ok: false; message: string }> {
  try {
    return { ok: true, sentTo: (await api.emailStart()).sentTo };
  } catch (e) {
    return { ok: false, message: errorText(e) };
  }
}

export async function confirmReauth(api: SecurityApi, ask: ReauthAsk, value: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await api.reauth(ask.kind === 'password' ? { password: value } : { method: ask.method, code: value.trim() });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: errorText(e) };
  }
}

/** "Creată <dată>, folosită <dată>"; a key never used says "niciodată". */
export function keySub(created: string, used: string | null, longDate: (iso: string) => string): string {
  const C = SECURITY_COPY.passkeys;
  return C.rowSub(longDate(created.slice(0, 10)), used ? longDate(used.slice(0, 10)) : C.neverUsed);
}

/**
 * The Google sign-in that re-confirms an account (it sets the device's confirmation time). It keeps the session as remembered or not, as it is now
 * (a token in `localStorage` means remembered), and comes back to Securitate.
 */
export const googleReauthUrl = (remembered: boolean): string => `/api/admin-auth/google/start?remember=${remembered ? '1' : '0'}&to=securitate`;

/** Whether this browser holds a remembered admin session (the token is in `localStorage`, not in the session cookie). */
export function isRemembered(storage: Pick<Storage, 'getItem'> | null): boolean {
  try {
    return storage?.getItem('jwtToken') != null;
  } catch {
    return false;
  }
}
