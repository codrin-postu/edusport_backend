import type { useFetchClient } from '@strapi/admin/strapi-admin';
import { fileNameFrom } from '../../../club/registration-panel';

type Get = ReturnType<typeof useFetchClient>['get'];

/** Admin PDF routes of plan 2D. */
export const registrationDocumentUrl = (documentId: string, kind: string) => `/api/club/registrations/${documentId}/documents/${kind}`;
export const blankFormUrl = (kind: string) => `/api/club/documents/blank/${kind}`;

/** Fetches a PDF with the admin token and saves it under the server's file name. */
export async function downloadPdf(get: Get, url: string, fallbackName: string): Promise<void> {
  const r = await get(url, { responseType: 'blob' });
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
