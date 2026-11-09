import type { AdminHandoff, CodeSent, SecondStep, TwoFactorMethod } from '../club/security/api-types';
import { API, type ApiResult, type Post } from './api';

/** What a login-like answer leads to. `expired` is a pending login that ended (ruling 1): back to the password form with its text. */
export type Next =
  | { kind: 'handoff'; handoff: AdminHandoff }
  | { kind: 'secondStep'; to: string; email: string }
  | { kind: 'expired'; message: string }
  | { kind: 'error'; message: string };

export const PATH = {
  login: '/intrare',
  invite: '/intrare/invitatie',
  reset: '/intrare/parola',
  secondStep: '/intrare/2fa',
  done: '/intrare/gata',
} as const;

const ALL_METHODS: readonly TwoFactorMethod[] = ['totp', 'email', 'backup'];
const isMethod = (v: string | null | undefined): v is TwoFactorMethod => ALL_METHODS.includes(v as TwoFactorMethod);

/** `/intrare/2fa?last=totp&methods=totp,backup`, with `via=google` for the Google first-link redirect (spec 4.6). */
export const secondStepUrl = (s: Pick<SecondStep, 'methods' | 'last'>, via?: 'google'): string =>
  `${PATH.secondStep}?last=${s.last}&methods=${s.methods.join(',')}${via ? `&via=${via}` : ''}`;

export type SecondStepQuery = { methods: TwoFactorMethod[]; last: TwoFactorMethod; viaGoogle: boolean };

/** Reads the second step's address; null when it lacks a usable method list (the page then goes back to the password form). */
export function parseSecondStepQuery(search: string): SecondStepQuery | null {
  const q = new URLSearchParams(search);
  const methods = (q.get('methods') ?? '').split(',').filter(isMethod);
  if (methods.length === 0) return null;
  const last = q.get('last');
  return { methods, last: isMethod(last) && methods.includes(last) ? last : methods[0], viaGoogle: q.get('via') === 'google' };
}

export const isSecondStep = (d: AdminHandoff | SecondStep): d is SecondStep => 'step' in d && d.step === '2fa';

/** A login-like answer (password, reset, second step) as the page's next move. */
export function nextOf(result: ApiResult<AdminHandoff | SecondStep>, step2 = false): Next {
  if (!result.ok) return step2 && result.status === 401 ? { kind: 'expired', message: result.message } : { kind: 'error', message: result.message };
  if (isSecondStep(result.data)) return { kind: 'secondStep', to: secondStepUrl(result.data), email: result.data.email };
  return { kind: 'handoff', handoff: result.data };
}

export type LoginFields = { email: string; password: string; rememberMe: boolean };

export async function submitLogin(post: Post, f: LoginFields): Promise<Next> {
  return nextOf(await post<AdminHandoff | SecondStep>(API.login, { email: f.email.trim(), password: f.password, rememberMe: f.rememberMe }));
}

export type SecondStepFields = { method: TwoFactorMethod; code: string; remember: boolean };

/** The body of `POST /api/admin-auth/2fa`; "Ține minte dispozitivul" starts ticked, so a fresh form sends `remember: true`. */
export const secondStepBody = (f: SecondStepFields): SecondStepFields => ({ method: f.method, code: f.code.trim(), remember: f.remember });
export const NEW_SECOND_STEP: SecondStepFields = { method: 'totp', code: '', remember: true };

export async function submitSecondStep(post: Post, f: SecondStepFields): Promise<Next> {
  return nextOf(await post<AdminHandoff>(API.twoFactor, secondStepBody(f)), true);
}

/** Sends (or re-sends) the e-mail code; `sentTo` is the address the server wrote to. */
export const sendEmailCode = (post: Post): Promise<ApiResult<CodeSent>> => post<CodeSent>(API.twoFactorEmail, {});

export const submitInvite = async (post: Post, registrationToken: string, password: string): Promise<Next> =>
  nextOf(await post<AdminHandoff>(API.inviteAccept, { registrationToken, password }));

export const submitResetConfirm = async (post: Post, f: { email: string; code: string; password: string }): Promise<Next> =>
  nextOf(await post<AdminHandoff | SecondStep>(API.resetConfirm, { email: f.email.trim(), code: f.code.trim(), password: f.password }));

export const googleStartUrl = (remember: boolean): string => `${API.googleStart}?remember=${remember ? '1' : '0'}`;
export const inviteGoogleUrl = (registrationToken: string): string => `${API.inviteGoogle}?registrationToken=${encodeURIComponent(registrationToken)}`;
