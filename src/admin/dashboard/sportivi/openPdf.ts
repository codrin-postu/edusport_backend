import type { useFetchClient } from '@strapi/admin/strapi-admin';

type Get = ReturnType<typeof useFetchClient>['get'];

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
