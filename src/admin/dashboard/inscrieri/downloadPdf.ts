import type { useFetchClient } from '@strapi/admin/strapi-admin';
import { fileNameFrom, requestErrorText } from '../../../club/registration-panel';

type Get = ReturnType<typeof useFetchClient>['get'];
type Post = ReturnType<typeof useFetchClient>['post'];
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

/** A file made from a request body (the tables' .xlsx and .csv): POST with the admin token, saved under the server's file name. */
export async function downloadPost(post: Post, url: string, body: unknown, fallbackName: string): Promise<void> {
  saveBlob(await post(url, body, { responseType: 'blob' }), fallbackName);
}

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
