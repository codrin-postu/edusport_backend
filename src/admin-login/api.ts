import { PORTAL_ERRORS } from '../club/portal/copy';

/** A `{ data }` answer, or the refusal `{ error: { status, message } }` of `refuseWith` (message: the exact Romanian text). */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string };
export type Post = <T>(path: string, body: unknown) => Promise<ApiResult<T>>;
type Fetch = (input: string, init: RequestInit) => Promise<Pick<Response, 'status' | 'json'>>;

export const API = {
  login: '/api/admin-auth/login',
  twoFactor: '/api/admin-auth/2fa',
  twoFactorEmail: '/api/admin-auth/2fa/email',
  resetRequest: '/api/admin-auth/reset/request',
  resetConfirm: '/api/admin-auth/reset/confirm',
  inviteRead: '/api/admin-auth/invite/read',
  inviteAccept: '/api/admin-auth/invite/accept',
  googleStart: '/api/admin-auth/google/start',
  inviteGoogle: '/api/admin-auth/invite/google',
} as const;

type Answer = { data?: unknown; error?: { message?: unknown } } | null;

/** Same-origin JSON POST. A network or parse failure is a refusal with the shared "nothing was saved" text, never a throw. */
export function createPost(fetchFn: Fetch): Post {
  return async <T>(path: string, body: unknown): Promise<ApiResult<T>> => {
    try {
      const res = await fetchFn(path, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });
      const answer = (await res.json()) as Answer;
      if (res.status >= 200 && res.status < 300 && answer && 'data' in answer && answer.data !== null) return { ok: true, data: answer.data as T };
      const message = answer?.error?.message;
      return { ok: false, status: res.status, message: typeof message === 'string' ? message : PORTAL_ERRORS.failed };
    } catch {
      return { ok: false, status: 0, message: PORTAL_ERRORS.failed };
    }
  };
}

export const post: Post = createPost((input, init) => fetch(input, init));
