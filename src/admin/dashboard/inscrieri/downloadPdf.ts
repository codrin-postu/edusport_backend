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
