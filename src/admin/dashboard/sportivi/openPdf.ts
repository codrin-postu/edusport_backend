import type { useFetchClient } from '@strapi/admin/strapi-admin';

type Get = ReturnType<typeof useFetchClient>['get'];

/** Opens an admin-guarded PDF in a new tab ("Vezi", spec 6.4): the route needs the admin token, so a plain link cannot. */
export async function viewPdf(get: Get, url: string): Promise<void> {
  const tab = window.open('', '_blank');
  try {
    const r = await get(url, { responseType: 'blob' });
    const href = URL.createObjectURL(r.data);
    if (tab) tab.location.href = href;
    else window.location.assign(href);
    setTimeout(() => URL.revokeObjectURL(href), 60000);
  } catch (err) {
    tab?.close();
    throw err;
  }
}
