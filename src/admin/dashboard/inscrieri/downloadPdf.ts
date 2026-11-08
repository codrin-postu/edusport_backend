import type { useFetchClient } from '@strapi/admin/strapi-admin';
import { fileNameFrom, requestErrorText } from '../../../club/registration-panel';

type Get = ReturnType<typeof useFetchClient>['get'];
type Saved = { data: Blob; headers?: { get(name: string): string | null } | null };

/** Admin PDF routes of plan 2D. */
export const registrationDocumentUrl = (documentId: string, kind: string) => `/api/club/registrations/${documentId}/documents/${kind}`;
export const blankFormUrl = (kind: string) => `/api/club/documents/blank/${kind}`;

/** Saves a fetched blob under the server's file name. */
function saveBlob(r: Saved, fallbackName: string): void {
  const a = document.createElement('a');
  const href = URL.createObjectURL(r.data);
  a.href = href;
  a.download = fileNameFrom(r.headers?.get('content-disposition'), fallbackName);
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked on the next tick: some Safari and Firefox versions cancel a download whose URL is revoked at once.
  setTimeout(() => URL.revokeObjectURL(href), 0);
}

/** Fetches a PDF with the admin token and saves it under the server's file name. */
export async function downloadPdf(get: Get, url: string, fallbackName: string): Promise<void> {
  saveBlob(await get(url, { responseType: 'blob' }), fallbackName);
}

/**
 * A file made from a request body (the tables' .xlsx and .csv): POST with the admin token, saved under the server's file name.
 * Strapi's fetch client ignores `responseType` on POST (it always reads JSON), so this uses fetch with the Bearer token.
 * The backend URL is prefixed and a 401 renews the token once (`opts.refresh`) and retries once.
 * A failed request throws an error whose `response.data` is the body blob, the shape `blobErrorText` reads.
 */
export type PostOptions = { backendURL?: string; refresh?: () => Promise<string>; onSessionExpired?: () => void };

async function downloadWith(method: 'GET' | 'POST', token: string | null, url: string, body: unknown, fallbackName: string, opts: PostOptions): Promise<void> {
  const send = (bearer: string | null) => fetch(`${opts.backendURL ?? ''}${url}`, {
    method,
    headers: { ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}), ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  });
  let res = await send(token);
  // An expired access token: renew it the way the Strapi client does, then ask once more.
  if (res.status === 401 && opts.refresh) {
    let fresh: string;
    try {
      fresh = await opts.refresh();
    } catch (err) {
      // The session is over: send the admin to the login the way the Strapi client does.
      opts.onSessionExpired?.();
      throw err;
    }
    res = await send(fresh);
  }
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { response: { data: await res.blob() } });
  saveBlob({ data: await res.blob(), headers: res.headers }, fallbackName);
}

export const downloadPost = (token: string | null, url: string, body: unknown, fallbackName: string, opts: PostOptions = {}): Promise<void> =>
  downloadWith('POST', token, url, body, fallbackName, opts);

/**
 * A file from a GET whose refusal text must reach the screen: Strapi's client throws a bodiless "Server Error" for a failed blob GET
 * (the Bani accounting .xlsx answers 501 with its own message), so this uses fetch like downloadPost.
 */
export const downloadGet = (token: string | null, url: string, fallbackName: string, opts: PostOptions = {}): Promise<void> =>
  downloadWith('GET', token, url, null, fallbackName, opts);

/** The server's message of a failed blob request: its error body is a blob too, read as JSON; the fallback when it has none. */
export async function blobErrorText(err: unknown, fallback: string): Promise<string> {
  const data = (err as { response?: { data?: unknown } } | null)?.response?.data;
  if (!(typeof Blob !== 'undefined' && data instanceof Blob)) return requestErrorText(err, fallback);
  try {
    return requestErrorText({ response: { data: JSON.parse(await data.text()) } }, fallback);
  } catch {
    return fallback;
  }
}

/**
 * Opens an admin-guarded PDF in a new tab ("Vezi", spec 6.4): the route needs the admin token, so a plain link cannot.
 * A blocked popup rejects (the caller shows its toast) instead of moving the admin away.
 */
export async function viewPdf(get: Get, url: string): Promise<void> {
  const tab = window.open('', '_blank');
  if (!tab) throw new Error('popup blocked');
  try {
    const r = await get(url, { responseType: 'blob' });
    const href = URL.createObjectURL(r.data);
    tab.location.href = href;
    setTimeout(() => URL.revokeObjectURL(href), 60000);
  } catch (err) {
    tab.close();
    throw err;
  }
}
